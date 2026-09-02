import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { generateIntegrationCredential } from './integration-auth.service.js';
import {
  encryptWebhookSigningSecret,
  generateWebhookSigningSecret,
} from './integration-secrets.js';
import {
  parseCreateIntegrationClient,
  parseCreateWebhookSubscription,
  parseLimit,
  parseUpdateWebhookSubscription,
  requireUuid,
} from './integrations.validation.js';

export interface IntegrationClientRecord {
  readonly id: string;
  readonly name: string;
  readonly status: 'active' | 'revoked';
  readonly scopes: readonly string[];
  readonly expiresAt: string | null;
  readonly lastUsedAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WebhookSubscriptionRecord {
  readonly id: string;
  readonly integrationClientId: string;
  readonly name: string;
  readonly endpointUrl: string;
  readonly eventTypes: readonly string[];
  readonly apiVersion: number;
  readonly status: 'active' | 'paused' | 'revoked';
  readonly maxAttempts: number;
  readonly timeoutMs: number;
  readonly lastDeliveryAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WebhookDeliveryRecord {
  readonly id: string;
  readonly subscriptionId: string;
  readonly integrationClientId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly idempotencyKey: string;
  readonly status: 'queued' | 'retry_wait' | 'succeeded' | 'dead_lettered' | 'cancelled';
  readonly attempts: number;
  readonly lastStatusCode: number | null;
  readonly lastError: string | null;
  readonly lastAttemptAt: string | null;
  readonly succeededAt: string | null;
  readonly deadLetteredAt: string | null;
  readonly cancelledAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WebhookAttemptRecord {
  readonly id: string;
  readonly attempt: number;
  readonly outcome: 'success' | 'failure' | 'cancelled';
  readonly statusCode: number | null;
  readonly durationMs: number;
  readonly errorMessage: string | null;
  readonly createdAt: string;
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async listClients(limitValue?: string): Promise<readonly IntegrationClientRecord[]> {
    const limit = parseLimit(limitValue);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<IntegrationClientRow>(
        `SELECT id::text,name,status,scopes,expires_at,last_used_at,revoked_at,revoked_reason,created_at,updated_at
           FROM integration_clients
          ORDER BY created_at DESC,id DESC
          LIMIT $1::int`,
        [limit],
      );
      return result.rows.map(mapIntegrationClient);
    });
  }

  async createClient(body: unknown): Promise<{
    readonly client: IntegrationClientRecord;
    readonly apiKey: string;
  }> {
    const input = parseCreateIntegrationClient(body);
    const context = this.tenantContext.require();
    const clientId = randomUUID();
    const credential = generateIntegrationCredential(clientId);

    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<IntegrationClientRow>(
        `INSERT INTO integration_clients (
           id,tenant_id,name,status,secret_hash,scopes,expires_at,created_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3,'active',$4::bytea,$5::text[],$6::timestamptz,$7::uuid)
         RETURNING id::text,name,status,scopes,expires_at,last_used_at,revoked_at,revoked_reason,created_at,updated_at`,
        [
          clientId,
          context.tenantId,
          input.name,
          Buffer.from(credential.secretHashHex, 'hex'),
          input.scopes,
          input.expiresAt,
          context.userId,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new ConflictException('Integration client could not be created');
      await insertUserAudit(client, context, {
        action: 'integration.client.created',
        entityType: 'integration_client',
        entityId: clientId,
        metadata: { name: input.name, scopes: input.scopes, expiresAt: input.expiresAt },
      });
      return { client: mapIntegrationClient(row), apiKey: credential.apiKey };
    });
  }

  async revokeClient(clientIdValue: string, body: unknown): Promise<IntegrationClientRecord> {
    const clientId = requireUuid(clientIdValue, 'clientId');
    const reason = parseReason(body);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const existing = await client.query<IntegrationClientRow>(
        `SELECT id::text,name,status,scopes,expires_at,last_used_at,revoked_at,revoked_reason,created_at,updated_at
           FROM integration_clients WHERE id=$1::uuid`,
        [clientId],
      );
      if (!existing.rows[0]) throw new NotFoundException('Integration client not found');
      if (existing.rows[0].status === 'revoked') {
        throw new ConflictException('Integration client is already revoked');
      }

      const result = await client.query<IntegrationClientRow>(
        `UPDATE integration_clients
            SET status='revoked',revoked_at=now(),revoked_by_user_id=$2::uuid,revoked_reason=$3,updated_at=now()
          WHERE id=$1::uuid
          RETURNING id::text,name,status,scopes,expires_at,last_used_at,revoked_at,revoked_reason,created_at,updated_at`,
        [clientId, context.userId, reason],
      );
      await client.query(
        `UPDATE webhook_subscriptions
            SET status='revoked',revoked_at=now(),revoked_by_user_id=$2::uuid,revoked_reason=$3,updated_by_user_id=$2::uuid,updated_at=now()
          WHERE integration_client_id=$1::uuid AND status <> 'revoked'`,
        [clientId, context.userId, `Integration client revoked: ${reason}`],
      );
      await insertUserAudit(client, context, {
        action: 'integration.client.revoked',
        entityType: 'integration_client',
        entityId: clientId,
        reason,
      });
      return mapIntegrationClient(result.rows[0]!);
    });
  }

  async listWebhooks(limitValue?: string): Promise<readonly WebhookSubscriptionRecord[]> {
    const limit = parseLimit(limitValue);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<WebhookSubscriptionRow>(
        `SELECT id::text,integration_client_id::text,name,endpoint_url,event_types,api_version,status,max_attempts,timeout_ms,
                last_delivery_at,last_success_at,last_failure_at,revoked_at,revoked_reason,created_at,updated_at
           FROM webhook_subscriptions
          ORDER BY created_at DESC,id DESC
          LIMIT $1::int`,
        [limit],
      );
      return result.rows.map(mapWebhookSubscription);
    });
  }

  async createWebhook(body: unknown): Promise<{
    readonly subscription: WebhookSubscriptionRecord;
    readonly signingSecret: string;
  }> {
    const input = parseCreateWebhookSubscription(body);
    const context = this.tenantContext.require();
    const signingSecret = generateWebhookSigningSecret();
    let encrypted: ReturnType<typeof encryptWebhookSigningSecret>;
    try {
      encrypted = encryptWebhookSigningSecret(signingSecret);
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : 'Webhook secret encryption is unavailable',
      );
    }

    return this.database.withTenantContext(context, async (client) => {
      const integration = await client.query<{ status: string }>(
        `SELECT status FROM integration_clients WHERE id=$1::uuid`,
        [input.integrationClientId],
      );
      if (!integration.rows[0]) throw new NotFoundException('Integration client not found');
      if (integration.rows[0].status !== 'active') {
        throw new ConflictException('Webhook subscription requires an active integration client');
      }

      const result = await client.query<WebhookSubscriptionRow>(
        `INSERT INTO webhook_subscriptions (
           tenant_id,integration_client_id,name,endpoint_url,event_types,api_version,status,
           signing_secret_ciphertext,signing_secret_iv,signing_secret_tag,max_attempts,timeout_ms,
           created_by_user_id,updated_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::text[],1,'active',$6,$7,$8,$9,$10,$11::uuid,$11::uuid)
         RETURNING id::text,integration_client_id::text,name,endpoint_url,event_types,api_version,status,max_attempts,timeout_ms,
                   last_delivery_at,last_success_at,last_failure_at,revoked_at,revoked_reason,created_at,updated_at`,
        [
          context.tenantId,
          input.integrationClientId,
          input.name,
          input.endpointUrl,
          input.eventTypes,
          encrypted.ciphertext,
          encrypted.iv,
          encrypted.tag,
          input.maxAttempts,
          input.timeoutMs,
          context.userId,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new ConflictException('Webhook subscription could not be created');
      await insertUserAudit(client, context, {
        action: 'integration.webhook.created',
        entityType: 'webhook_subscription',
        entityId: row.id,
        metadata: {
          integrationClientId: input.integrationClientId,
          endpointHost: new URL(input.endpointUrl).host,
          eventTypes: input.eventTypes,
          apiVersion: 1,
          maxAttempts: input.maxAttempts,
          timeoutMs: input.timeoutMs,
        },
      });
      return { subscription: mapWebhookSubscription(row), signingSecret };
    });
  }

  async updateWebhook(subscriptionIdValue: string, body: unknown): Promise<WebhookSubscriptionRecord> {
    const subscriptionId = requireUuid(subscriptionIdValue, 'subscriptionId');
    const input = parseUpdateWebhookSubscription(body);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const existingResult = await client.query<WebhookSubscriptionRow>(
        `SELECT id::text,integration_client_id::text,name,endpoint_url,event_types,api_version,status,max_attempts,timeout_ms,
                last_delivery_at,last_success_at,last_failure_at,revoked_at,revoked_reason,created_at,updated_at
           FROM webhook_subscriptions WHERE id=$1::uuid`,
        [subscriptionId],
      );
      const existing = existingResult.rows[0];
      if (!existing) throw new NotFoundException('Webhook subscription not found');
      if (existing.status === 'revoked') {
        throw new ConflictException('Revoked webhook subscriptions are immutable');
      }

      const nextStatus = input.status ?? existing.status;
      const revoking = nextStatus === 'revoked';
      const result = await client.query<WebhookSubscriptionRow>(
        `UPDATE webhook_subscriptions
            SET name=$2,
                endpoint_url=$3,
                event_types=$4::text[],
                status=$5,
                max_attempts=$6,
                timeout_ms=$7,
                updated_by_user_id=$8::uuid,
                revoked_at=CASE WHEN $5='revoked' THEN now() ELSE NULL END,
                revoked_by_user_id=CASE WHEN $5='revoked' THEN $8::uuid ELSE NULL END,
                revoked_reason=CASE WHEN $5='revoked' THEN $9 ELSE NULL END,
                updated_at=now()
          WHERE id=$1::uuid
          RETURNING id::text,integration_client_id::text,name,endpoint_url,event_types,api_version,status,max_attempts,timeout_ms,
                    last_delivery_at,last_success_at,last_failure_at,revoked_at,revoked_reason,created_at,updated_at`,
        [
          subscriptionId,
          input.name ?? existing.name,
          input.endpointUrl ?? existing.endpoint_url,
          input.eventTypes ?? existing.event_types,
          nextStatus,
          input.maxAttempts ?? existing.max_attempts,
          input.timeoutMs ?? existing.timeout_ms,
          context.userId,
          revoking ? input.reason : null,
        ],
      );
      await insertUserAudit(client, context, {
        action: revoking ? 'integration.webhook.revoked' : 'integration.webhook.updated',
        entityType: 'webhook_subscription',
        entityId: subscriptionId,
        reason: revoking ? input.reason : undefined,
        metadata: { status: nextStatus, eventTypes: input.eventTypes ?? existing.event_types },
      });
      return mapWebhookSubscription(result.rows[0]!);
    });
  }

  async listDeliveries(input: {
    readonly limit?: string;
    readonly status?: string;
    readonly clientId?: string;
    readonly subscriptionId?: string;
  }): Promise<readonly WebhookDeliveryRecord[]> {
    const limit = parseLimit(input.limit);
    const status = parseDeliveryStatus(input.status);
    const clientId = input.clientId ? requireUuid(input.clientId, 'clientId') : null;
    const subscriptionId = input.subscriptionId
      ? requireUuid(input.subscriptionId, 'subscriptionId')
      : null;
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const values: unknown[] = [];
      const filters: string[] = [];
      if (status) {
        values.push(status);
        filters.push(`status=$${values.length}`);
      }
      if (clientId) {
        values.push(clientId);
        filters.push(`integration_client_id=$${values.length}::uuid`);
      }
      if (subscriptionId) {
        values.push(subscriptionId);
        filters.push(`subscription_id=$${values.length}::uuid`);
      }
      values.push(limit);
      const result = await client.query<WebhookDeliveryRow>(
        `SELECT id::text,subscription_id::text,integration_client_id::text,event_type,event_version,idempotency_key,status,attempts,
                last_status_code,last_error,last_attempt_at,succeeded_at,dead_lettered_at,cancelled_at,created_at,updated_at
           FROM webhook_deliveries
          ${filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''}
          ORDER BY created_at DESC,id DESC
          LIMIT $${values.length}::int`,
        values,
      );
      return result.rows.map(mapWebhookDelivery);
    });
  }

  async listAttempts(
    deliveryIdValue: string,
    limitValue?: string,
  ): Promise<readonly WebhookAttemptRecord[]> {
    const deliveryId = requireUuid(deliveryIdValue, 'deliveryId');
    const limit = parseLimit(limitValue);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const delivery = await client.query('SELECT 1 FROM webhook_deliveries WHERE id=$1::uuid', [
        deliveryId,
      ]);
      if (!delivery.rows[0]) throw new NotFoundException('Webhook delivery not found');
      const result = await client.query<WebhookAttemptRow>(
        `SELECT id::text,attempt,outcome,status_code,duration_ms,error_message,created_at
           FROM webhook_delivery_attempts
          WHERE delivery_id=$1::uuid
          ORDER BY created_at DESC,id DESC
          LIMIT $2::int`,
        [deliveryId, limit],
      );
      return result.rows.map(mapWebhookAttempt);
    });
  }
}

type IntegrationClientRow = {
  id: string;
  name: string;
  status: 'active' | 'revoked';
  scopes: string[];
  expires_at: Date | null;
  last_used_at: Date | null;
  revoked_at: Date | null;
  revoked_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

type WebhookSubscriptionRow = {
  id: string;
  integration_client_id: string;
  name: string;
  endpoint_url: string;
  event_types: string[];
  api_version: number;
  status: 'active' | 'paused' | 'revoked';
  max_attempts: number;
  timeout_ms: number;
  last_delivery_at: Date | null;
  last_success_at: Date | null;
  last_failure_at: Date | null;
  revoked_at: Date | null;
  revoked_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

type WebhookDeliveryRow = {
  id: string;
  subscription_id: string;
  integration_client_id: string;
  event_type: string;
  event_version: number;
  idempotency_key: string;
  status: WebhookDeliveryRecord['status'];
  attempts: number;
  last_status_code: number | null;
  last_error: string | null;
  last_attempt_at: Date | null;
  succeeded_at: Date | null;
  dead_lettered_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type WebhookAttemptRow = {
  id: string;
  attempt: number;
  outcome: WebhookAttemptRecord['outcome'];
  status_code: number | null;
  duration_ms: number;
  error_message: string | null;
  created_at: Date;
};

function mapIntegrationClient(row: IntegrationClientRow): IntegrationClientRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    scopes: row.scopes,
    expiresAt: row.expires_at?.toISOString() ?? null,
    lastUsedAt: row.last_used_at?.toISOString() ?? null,
    revokedAt: row.revoked_at?.toISOString() ?? null,
    revokedReason: row.revoked_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapWebhookSubscription(row: WebhookSubscriptionRow): WebhookSubscriptionRecord {
  return {
    id: row.id,
    integrationClientId: row.integration_client_id,
    name: row.name,
    endpointUrl: row.endpoint_url,
    eventTypes: row.event_types,
    apiVersion: row.api_version,
    status: row.status,
    maxAttempts: row.max_attempts,
    timeoutMs: row.timeout_ms,
    lastDeliveryAt: row.last_delivery_at?.toISOString() ?? null,
    lastSuccessAt: row.last_success_at?.toISOString() ?? null,
    lastFailureAt: row.last_failure_at?.toISOString() ?? null,
    revokedAt: row.revoked_at?.toISOString() ?? null,
    revokedReason: row.revoked_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapWebhookDelivery(row: WebhookDeliveryRow): WebhookDeliveryRecord {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    integrationClientId: row.integration_client_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    attempts: row.attempts,
    lastStatusCode: row.last_status_code,
    lastError: row.last_error,
    lastAttemptAt: row.last_attempt_at?.toISOString() ?? null,
    succeededAt: row.succeeded_at?.toISOString() ?? null,
    deadLetteredAt: row.dead_lettered_at?.toISOString() ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapWebhookAttempt(row: WebhookAttemptRow): WebhookAttemptRecord {
  return {
    id: row.id,
    attempt: row.attempt,
    outcome: row.outcome,
    statusCode: row.status_code,
    durationMs: row.duration_ms,
    errorMessage: row.error_message,
    createdAt: row.created_at.toISOString(),
  };
}

function parseReason(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('body must be an object');
  }
  const reason = (body as Record<string, unknown>).reason;
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 1000) {
    throw new BadRequestException('reason must contain between 3 and 1000 characters');
  }
  return reason.trim();
}

function parseDeliveryStatus(value: string | undefined): WebhookDeliveryRecord['status'] | null {
  if (!value || value === 'all') return null;
  const allowed: readonly WebhookDeliveryRecord['status'][] = [
    'queued',
    'retry_wait',
    'succeeded',
    'dead_lettered',
    'cancelled',
  ];
  if (allowed.includes(value as WebhookDeliveryRecord['status'])) {
    return value as WebhookDeliveryRecord['status'];
  }
  throw new BadRequestException(`status must be one of: all, ${allowed.join(', ')}`);
}

async function insertUserAudit(
  client: import('pg').PoolClient,
  context: { readonly tenantId: string; readonly userId: string },
  event: {
    readonly action: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly reason?: string;
    readonly metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (
       tenant_id,action,outcome,source,entity_type,entity_id,actor_type,actor_user_id,reason,metadata
     ) VALUES ($1::uuid,$2,'success','api',$3,$4,'user',$5::uuid,$6,$7::jsonb)`,
    [
      context.tenantId,
      event.action,
      event.entityType,
      event.entityId,
      context.userId,
      event.reason ?? null,
      JSON.stringify(event.metadata ?? {}),
    ],
  );
}
