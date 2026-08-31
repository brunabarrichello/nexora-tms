import { createHash, randomBytes } from 'node:crypto';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

export type PretenantAuthEventType =
  | 'auth.bearer.missing'
  | 'auth.bearer.rejected'
  | 'auth.identity.unlinked'
  | 'auth.identity.accepted';

export interface PretenantAuthEvent {
  readonly eventType: PretenantAuthEventType;
  readonly outcome: 'success' | 'failure' | 'denied';
  readonly providerKey?: string;
  readonly subject?: string;
  readonly userId?: string;
  readonly requestId?: string;
  readonly correlationId?: string;
}

export function createUuidV7(now = Date.now()): string {
  const bytes = randomBytes(16);
  let timestamp = BigInt(now);

  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function fingerprintExternalSubject(
  providerKey: string,
  subject: string,
): string {
  return createHash('sha256')
    .update(providerKey)
    .update('\0')
    .update(subject)
    .digest('hex');
}

@Injectable()
export class PretenantAuthAuditService implements OnModuleDestroy {
  private readonly logger = new Logger(PretenantAuthAuditService.name);
  private pool?: Pool;

  async record(event: PretenantAuthEvent): Promise<void> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      this.logger.error(
        `pre-tenant auth audit unavailable: DATABASE_URL missing (${event.eventType})`,
      );
      return;
    }

    try {
      await this.getPool(connectionString).query(
        `INSERT INTO pretenant_auth_events
          (id, event_type, outcome, provider_key, subject_fingerprint, user_id, request_id, correlation_id)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, $7, $8)`,
        [
          createUuidV7(),
          event.eventType,
          event.outcome,
          event.providerKey ?? null,
          event.providerKey && event.subject
            ? fingerprintExternalSubject(event.providerKey, event.subject)
            : null,
          event.userId ?? null,
          event.requestId ?? null,
          event.correlationId ?? null,
        ],
      );
    } catch {
      // Authentication remains deterministic if the audit sink is unavailable.
      // Never include token, subject, credential or database errors in logs.
      this.logger.error(
        `pre-tenant auth audit persistence failed (${event.eventType})`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  private getPool(connectionString: string): Pool {
    if (!this.pool) {
      const configuredMax = Number.parseInt(
        process.env.AUTH_AUDIT_DATABASE_POOL_MAX ?? '2',
        10,
      );
      const max =
        Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 2;
      this.pool = new Pool({
        application_name: 'nexora-tms-api-auth-audit',
        connectionString,
        max,
      });
    }
    return this.pool;
  }
}
