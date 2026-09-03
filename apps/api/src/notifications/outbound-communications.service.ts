import { Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import type {
  CommunicationPreferenceRecord,
  CommunicationProviderRouteRecord,
  CommunicationTemplateRecord,
  OutboundCommunicationAttemptRecord,
  OutboundCommunicationRecord,
  QueueCommunicationResult,
} from './outbound-communications.types.js';
import {
  parseChannel,
  parseCommunicationStatus,
  parseCreateTemplate,
  parseLimit,
  parsePreference,
  parseQueueCommunication,
  parseRecipientType,
  parseTemplateStatus,
  parseUpsertProviderRoute,
  requireUuid,
} from './outbound-communications.validation.js';

interface ProviderRouteRow {
  id: string;
  channel: 'email' | 'whatsapp' | 'sms';
  provider_code: string;
  status: 'active' | 'disabled';
  created_at: Date;
  updated_at: Date;
}

interface TemplateRow {
  id: string;
  template_key: string;
  channel: 'email' | 'whatsapp' | 'sms';
  locale: string;
  version: number;
  subject_template: string | null;
  body_template: string;
  status: 'draft' | 'active' | 'retired';
  created_at: Date;
  updated_at: Date;
}

interface PreferenceRow {
  id: string;
  recipient_type: 'driver' | 'party_contact';
  recipient_id: string;
  channel: 'email' | 'whatsapp' | 'sms';
  enabled: boolean;
  consent_status: 'granted' | 'denied' | 'unknown';
  consent_source: string | null;
  consented_at: Date | null;
  policy_version: string;
  created_at: Date;
  updated_at: Date;
}

interface CommunicationRow {
  id: string;
  template_id: string;
  template_key: string;
  template_version: number;
  channel: 'email' | 'whatsapp' | 'sms';
  recipient_type: 'driver' | 'party_contact';
  recipient_id: string;
  provider_code: string | null;
  status: 'queued' | 'retry_wait' | 'sent' | 'failed' | 'blocked' | 'cancelled';
  blocked_reason: string | null;
  last_error: string | null;
  durable_job_id: string | null;
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
  sent_at: Date | null;
}

interface AttemptRow {
  id: string;
  attempt_no: number;
  job_attempt: number;
  provider_code: string;
  outcome: 'success' | 'failure' | 'cancelled';
  provider_message_id: string | null;
  status_code: number | null;
  duration_ms: number;
  error_message: string | null;
  created_at: Date;
}

const communicationSelect = `
  SELECT id::text,template_id::text,template_key,template_version,channel,recipient_type,recipient_id::text,
         provider_code,status,blocked_reason,last_error,durable_job_id::text,idempotency_key,created_at,updated_at,sent_at
    FROM outbound_communications
`;

@Injectable()
export class OutboundCommunicationsService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async listProviderRoutes(): Promise<readonly CommunicationProviderRouteRecord[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<ProviderRouteRow>(
        `SELECT id::text,channel,provider_code,status,created_at,updated_at
           FROM communication_provider_routes
          ORDER BY channel`,
      );
      return result.rows.map(mapProviderRoute);
    });
  }

  async upsertProviderRoute(
    channelValue: string,
    body: unknown,
  ): Promise<CommunicationProviderRouteRecord> {
    const channel = parseChannel(channelValue);
    const input = parseUpsertProviderRoute(body);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<{ id: string }>(
        `SELECT nexora_upsert_communication_provider_route($1,$2,$3)::text AS id`,
        [channel, input.providerCode, input.status],
      );
      const id = result.rows[0]?.id;
      if (!id) throw new NotFoundException('Communication provider route could not be saved');
      const saved = await client.query<ProviderRouteRow>(
        `SELECT id::text,channel,provider_code,status,created_at,updated_at
           FROM communication_provider_routes WHERE id=$1::uuid`,
        [id],
      );
      return mapProviderRoute(saved.rows[0]!);
    });
  }

  async listTemplates(input: {
    readonly channel?: string;
    readonly limit?: string;
  }): Promise<readonly CommunicationTemplateRecord[]> {
    const channel = input.channel ? parseChannel(input.channel) : null;
    const limit = parseLimit(input.limit);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<TemplateRow>(
        `SELECT id::text,template_key,channel,locale,version,subject_template,body_template,status,created_at,updated_at
           FROM communication_templates
          WHERE ($1::text IS NULL OR channel=$1)
          ORDER BY template_key,channel,locale,version DESC
          LIMIT $2::int`,
        [channel, limit],
      );
      return result.rows.map(mapTemplate);
    });
  }

  async createTemplate(body: unknown): Promise<CommunicationTemplateRecord> {
    const input = parseCreateTemplate(body);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const created = await client.query<{ id: string }>(
        `SELECT nexora_create_communication_template($1,$2,$3,$4,$5,$6,$7)::text AS id`,
        [
          input.templateKey,
          input.channel,
          input.locale,
          input.version,
          input.subjectTemplate,
          input.bodyTemplate,
          input.status,
        ],
      );
      const id = created.rows[0]?.id;
      if (!id) throw new NotFoundException('Communication template could not be created');
      return this.getTemplateWithClient(client, id);
    });
  }

  async setTemplateStatus(templateIdValue: string, body: unknown): Promise<CommunicationTemplateRecord> {
    const templateId = requireUuid(templateIdValue, 'templateId');
    const input = parseTemplateStatus(body);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const updated = await client.query<{ updated: boolean }>(
        `SELECT nexora_set_communication_template_status($1::uuid,$2) AS updated`,
        [templateId, input.status],
      );
      if (updated.rows[0]?.updated !== true) {
        throw new NotFoundException('Communication template not found or already retired');
      }
      return this.getTemplateWithClient(client, templateId);
    });
  }

  async listPreferences(input: {
    readonly recipientType?: string;
    readonly recipientId?: string;
    readonly channel?: string;
    readonly limit?: string;
  }): Promise<readonly CommunicationPreferenceRecord[]> {
    const recipientType = input.recipientType ? parseRecipientType(input.recipientType) : null;
    const recipientId = input.recipientId ? requireUuid(input.recipientId, 'recipientId') : null;
    const channel = input.channel ? parseChannel(input.channel) : null;
    const limit = parseLimit(input.limit);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<PreferenceRow>(
        `SELECT id::text,recipient_type,recipient_id::text,channel,enabled,consent_status,consent_source,consented_at,
                policy_version,created_at,updated_at
           FROM communication_preferences
          WHERE ($1::text IS NULL OR recipient_type=$1)
            AND ($2::uuid IS NULL OR recipient_id=$2)
            AND ($3::text IS NULL OR channel=$3)
          ORDER BY updated_at DESC,id DESC
          LIMIT $4::int`,
        [recipientType, recipientId, channel, limit],
      );
      return result.rows.map(mapPreference);
    });
  }

  async upsertPreference(body: unknown): Promise<CommunicationPreferenceRecord> {
    const input = parsePreference(body);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const saved = await client.query<{ id: string }>(
        `SELECT nexora_upsert_communication_preference(
           $1,$2::uuid,$3,$4,$5,$6,$7::timestamptz,$8
         )::text AS id`,
        [
          input.recipientType,
          input.recipientId,
          input.channel,
          input.enabled,
          input.consentStatus,
          input.consentSource,
          input.consentedAt,
          input.policyVersion,
        ],
      );
      const id = saved.rows[0]?.id;
      if (!id) throw new NotFoundException('Communication preference could not be saved');
      const result = await client.query<PreferenceRow>(
        `SELECT id::text,recipient_type,recipient_id::text,channel,enabled,consent_status,consent_source,consented_at,
                policy_version,created_at,updated_at
           FROM communication_preferences WHERE id=$1::uuid`,
        [id],
      );
      return mapPreference(result.rows[0]!);
    });
  }

  async listCommunications(input: {
    readonly status?: string;
    readonly channel?: string;
    readonly limit?: string;
  }): Promise<readonly OutboundCommunicationRecord[]> {
    const status = parseCommunicationStatus(input.status);
    const channel = input.channel ? parseChannel(input.channel) : null;
    const limit = parseLimit(input.limit);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<CommunicationRow>(
        `${communicationSelect}
         WHERE ($1::text IS NULL OR status=$1)
           AND ($2::text IS NULL OR channel=$2)
         ORDER BY created_at DESC,id DESC
         LIMIT $3::int`,
        [status, channel, limit],
      );
      return result.rows.map(mapCommunication);
    });
  }

  async getCommunication(communicationIdValue: string): Promise<OutboundCommunicationRecord> {
    const communicationId = requireUuid(communicationIdValue, 'communicationId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, (client) =>
      this.getCommunicationWithClient(client, communicationId),
    );
  }

  async listAttempts(
    communicationIdValue: string,
    limitValue?: string,
  ): Promise<readonly OutboundCommunicationAttemptRecord[]> {
    const communicationId = requireUuid(communicationIdValue, 'communicationId');
    const limit = parseLimit(limitValue);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.getCommunicationWithClient(client, communicationId);
      const result = await client.query<AttemptRow>(
        `SELECT id::text,attempt_no,job_attempt,provider_code,outcome,provider_message_id,status_code,duration_ms,
                error_message,created_at
           FROM outbound_communication_attempts
          WHERE communication_id=$1::uuid
          ORDER BY attempt_no DESC
          LIMIT $2::int`,
        [communicationId, limit],
      );
      return result.rows.map(mapAttempt);
    });
  }

  async queueCommunication(body: unknown): Promise<QueueCommunicationResult> {
    const input = parseQueueCommunication(body);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const queued = await client.query<{
        communication_id: string;
        durable_job_id: string | null;
        communication_status: string;
        blocked_reason: string | null;
      }>(
        `SELECT communication_id::text,durable_job_id::text,communication_status,blocked_reason
           FROM nexora_queue_communication($1::uuid,$2,$3::uuid,$4::jsonb,$5,$6)`,
        [
          input.templateId,
          input.recipientType,
          input.recipientId,
          JSON.stringify(input.variables),
          input.idempotencyKey,
          input.maxAttempts,
        ],
      );
      const row = queued.rows[0];
      if (!row) throw new NotFoundException('Communication could not be queued');
      const communication = await this.getCommunicationWithClient(client, row.communication_id);
      return {
        communication,
        blocked: row.communication_status === 'blocked',
        blockedReason: row.blocked_reason,
      };
    });
  }

  private async getTemplateWithClient(
    client: Parameters<Parameters<TenantDatabaseService['withTenantContext']>[1]>[0],
    templateId: string,
  ): Promise<CommunicationTemplateRecord> {
    const result = await client.query<TemplateRow>(
      `SELECT id::text,template_key,channel,locale,version,subject_template,body_template,status,created_at,updated_at
         FROM communication_templates WHERE id=$1::uuid`,
      [templateId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Communication template not found');
    return mapTemplate(row);
  }

  private async getCommunicationWithClient(
    client: Parameters<Parameters<TenantDatabaseService['withTenantContext']>[1]>[0],
    communicationId: string,
  ): Promise<OutboundCommunicationRecord> {
    const result = await client.query<CommunicationRow>(
      `${communicationSelect} WHERE id=$1::uuid`,
      [communicationId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Outbound communication not found');
    return mapCommunication(row);
  }
}

function mapProviderRoute(row: ProviderRouteRow): CommunicationProviderRouteRecord {
  return {
    id: row.id,
    channel: row.channel,
    providerCode: row.provider_code,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapTemplate(row: TemplateRow): CommunicationTemplateRecord {
  return {
    id: row.id,
    templateKey: row.template_key,
    channel: row.channel,
    locale: row.locale,
    version: row.version,
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapPreference(row: PreferenceRow): CommunicationPreferenceRecord {
  return {
    id: row.id,
    recipientType: row.recipient_type,
    recipientId: row.recipient_id,
    channel: row.channel,
    enabled: row.enabled,
    consentStatus: row.consent_status,
    consentSource: row.consent_source,
    consentedAt: row.consented_at?.toISOString() ?? null,
    policyVersion: row.policy_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapCommunication(row: CommunicationRow): OutboundCommunicationRecord {
  return {
    id: row.id,
    templateId: row.template_id,
    templateKey: row.template_key,
    templateVersion: row.template_version,
    channel: row.channel,
    recipientType: row.recipient_type,
    recipientId: row.recipient_id,
    providerCode: row.provider_code,
    status: row.status,
    blockedReason: row.blocked_reason,
    lastError: row.last_error,
    durableJobId: row.durable_job_id,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    sentAt: row.sent_at?.toISOString() ?? null,
  };
}

function mapAttempt(row: AttemptRow): OutboundCommunicationAttemptRecord {
  return {
    id: row.id,
    attemptNo: row.attempt_no,
    jobAttempt: row.job_attempt,
    providerCode: row.provider_code,
    outcome: row.outcome,
    providerMessageId: row.provider_message_id,
    statusCode: row.status_code,
    durationMs: row.duration_ms,
    errorMessage: row.error_message,
    createdAt: row.created_at.toISOString(),
  };
}
