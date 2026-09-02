import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import type {
  AsyncJobRecord,
  AsyncJobState,
  AsyncOutboxRecord,
  AsyncOutboxState,
  AsyncReprocessResult,
} from './async-admin.types.js';

interface OutboxRow {
  readonly id: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly event_type: string;
  readonly event_version: number;
  readonly idempotency_key: string;
  readonly correlation_id: string | null;
  readonly request_id: string | null;
  readonly state: AsyncOutboxState;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly available_at: Date;
  readonly occurred_at: Date;
  readonly processed_at: Date | null;
  readonly lease_owner: string | null;
  readonly lease_expires_at: Date | null;
  readonly last_error: string | null;
  readonly dead_lettered_at: Date | null;
  readonly dead_letter_reason: string | null;
}

interface JobRow {
  readonly id: string;
  readonly source_outbox_event_id: string | null;
  readonly job_type: string;
  readonly idempotency_key: string;
  readonly correlation_id: string | null;
  readonly request_id: string | null;
  readonly status: AsyncJobState;
  readonly attempt: number;
  readonly max_attempts: number;
  readonly run_at: Date;
  readonly locked_at: Date | null;
  readonly locked_by: string | null;
  readonly lease_expires_at: Date | null;
  readonly last_error: string | null;
  readonly finished_at: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

@Injectable()
export class AsyncAdminService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async listOutbox(input: {
    readonly state?: string;
    readonly eventType?: string;
    readonly limit?: string;
  }): Promise<readonly AsyncOutboxRecord[]> {
    const state = normalizeOutboxState(input.state);
    const eventType = normalizeOptionalText(input.eventType, 'eventType', 160);
    const limit = normalizeLimit(input.limit);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const filters: string[] = [];
      const values: unknown[] = [];

      if (state) {
        values.push(state);
        filters.push(`(
          CASE
            WHEN dead_lettered_at IS NOT NULL THEN 'dead_lettered'
            WHEN processed_at IS NOT NULL THEN 'processed'
            WHEN lease_expires_at IS NOT NULL AND lease_expires_at > now() THEN 'leased'
            WHEN attempts > 0 AND available_at > now() THEN 'retry_wait'
            ELSE 'pending'
          END
        ) = $${values.length}`);
      }
      if (eventType) {
        values.push(eventType);
        filters.push(`event_type = $${values.length}`);
      }
      values.push(limit);

      const result = await client.query<OutboxRow>(
        `SELECT
           id::text AS id,
           aggregate_type,
           aggregate_id,
           event_type,
           event_version,
           idempotency_key,
           correlation_id,
           request_id,
           CASE
             WHEN dead_lettered_at IS NOT NULL THEN 'dead_lettered'
             WHEN processed_at IS NOT NULL THEN 'processed'
             WHEN lease_expires_at IS NOT NULL AND lease_expires_at > now() THEN 'leased'
             WHEN attempts > 0 AND available_at > now() THEN 'retry_wait'
             ELSE 'pending'
           END AS state,
           attempts,
           max_attempts,
           available_at,
           occurred_at,
           processed_at,
           lease_owner,
           lease_expires_at,
           last_error,
           dead_lettered_at,
           dead_letter_reason
         FROM outbox_events
         ${filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''}
         ORDER BY occurred_at DESC,id DESC
         LIMIT $${values.length}::int`,
        values,
      );
      return result.rows.map(mapOutbox);
    });
  }

  async listJobs(input: {
    readonly state?: string;
    readonly jobType?: string;
    readonly limit?: string;
  }): Promise<readonly AsyncJobRecord[]> {
    const state = normalizeJobState(input.state);
    const jobType = normalizeOptionalText(input.jobType, 'jobType', 160);
    const limit = normalizeLimit(input.limit);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const filters: string[] = [];
      const values: unknown[] = [];
      if (state) {
        values.push(state);
        filters.push(`status = $${values.length}`);
      }
      if (jobType) {
        values.push(jobType);
        filters.push(`job_type = $${values.length}`);
      }
      values.push(limit);

      const result = await client.query<JobRow>(
        `SELECT
           id::text AS id,
           source_outbox_event_id::text AS source_outbox_event_id,
           job_type,
           idempotency_key,
           correlation_id,
           request_id,
           status,
           attempt,
           max_attempts,
           run_at,
           locked_at,
           locked_by,
           lease_expires_at,
           last_error,
           finished_at,
           created_at,
           updated_at
         FROM durable_jobs
         ${filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''}
         ORDER BY created_at DESC,id DESC
         LIMIT $${values.length}::int`,
        values,
      );
      return result.rows.map(mapJob);
    });
  }

  async reprocessOutbox(id: string, body: unknown): Promise<AsyncReprocessResult> {
    const eventId = requireUuid(id, 'eventId');
    const reason = requireReason(body);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const existing = await client.query<{
        dead_lettered_at: Date | null;
        processed_at: Date | null;
      }>(
        `SELECT dead_lettered_at,processed_at
           FROM outbox_events
          WHERE id=$1::uuid`,
        [eventId],
      );
      const row = existing.rows[0];
      if (!row) throw new NotFoundException('Outbox event not found in current tenant');
      if (row.processed_at)
        throw new ConflictException('Processed outbox events cannot be reprocessed');
      if (!row.dead_lettered_at)
        throw new ConflictException('Only dead-lettered outbox events can be reprocessed');

      try {
        const result = await client.query<{ requeued: boolean }>(
          `SELECT nexora_admin_requeue_outbox_event($1::uuid,$2::text) AS requeued`,
          [eventId, reason],
        );
        if (!result.rows[0]?.requeued) {
          throw new ConflictException('Outbox event is no longer eligible for reprocessing');
        }
      } catch (error) {
        throw mapDatabaseError(error);
      }

      return { kind: 'outbox', id: eventId, requeued: true };
    });
  }

  async reprocessJob(id: string, body: unknown): Promise<AsyncReprocessResult> {
    const jobId = requireUuid(id, 'jobId');
    const reason = requireReason(body);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const existing = await client.query<{ status: AsyncJobState }>(
        `SELECT status
           FROM durable_jobs
          WHERE id=$1::uuid`,
        [jobId],
      );
      const row = existing.rows[0];
      if (!row) throw new NotFoundException('Durable job not found in current tenant');
      if (row.status !== 'dead_lettered') {
        throw new ConflictException('Only dead-lettered durable jobs can be reprocessed');
      }

      try {
        const result = await client.query<{ requeued: boolean }>(
          `SELECT nexora_admin_requeue_durable_job($1::uuid,$2::text) AS requeued`,
          [jobId, reason],
        );
        if (!result.rows[0]?.requeued) {
          throw new ConflictException('Durable job is no longer eligible for reprocessing');
        }
      } catch (error) {
        throw mapDatabaseError(error);
      }

      return { kind: 'job', id: jobId, requeued: true };
    });
  }
}

function normalizeOutboxState(value: string | undefined): AsyncOutboxState | null {
  if (!value || value === 'all') return null;
  const allowed: readonly AsyncOutboxState[] = [
    'pending',
    'retry_wait',
    'leased',
    'processed',
    'dead_lettered',
  ];
  if (allowed.includes(value as AsyncOutboxState)) return value as AsyncOutboxState;
  throw new BadRequestException(`state must be one of: all, ${allowed.join(', ')}`);
}

function normalizeJobState(value: string | undefined): AsyncJobState | null {
  if (!value || value === 'all') return null;
  const allowed: readonly AsyncJobState[] = [
    'pending',
    'running',
    'retry_wait',
    'succeeded',
    'dead_lettered',
    'cancelled',
  ];
  if (allowed.includes(value as AsyncJobState)) return value as AsyncJobState;
  throw new BadRequestException(`state must be one of: all, ${allowed.join(', ')}`);
}

function normalizeOptionalText(
  value: string | undefined,
  field: string,
  max: number,
): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max) {
    throw new BadRequestException(`${field} must contain between 1 and ${max} characters`);
  }
  return normalized;
}

function normalizeLimit(value: string | undefined): number {
  if (!value) return 100;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 200) {
    throw new BadRequestException('limit must be an integer between 1 and 200');
  }
  return parsed;
}

function requireReason(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('body must be an object');
  }
  const reason = (body as Record<string, unknown>).reason;
  if (typeof reason !== 'string') {
    throw new BadRequestException('reason is required');
  }
  const normalized = reason.trim();
  if (normalized.length < 3 || normalized.length > 500) {
    throw new BadRequestException('reason must contain between 3 and 500 characters');
  }
  return normalized;
}

function requireUuid(value: string, field: string): string {
  const normalized = value.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
  ) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return normalized;
}

function mapOutbox(row: OutboxRow): AsyncOutboxRecord {
  return {
    id: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    requestId: row.request_id,
    state: row.state,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    availableAt: row.available_at.toISOString(),
    occurredAt: row.occurred_at.toISOString(),
    processedAt: row.processed_at?.toISOString() ?? null,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at?.toISOString() ?? null,
    lastError: row.last_error,
    deadLetteredAt: row.dead_lettered_at?.toISOString() ?? null,
    deadLetterReason: row.dead_letter_reason,
  };
}

function mapJob(row: JobRow): AsyncJobRecord {
  return {
    id: row.id,
    sourceOutboxEventId: row.source_outbox_event_id,
    jobType: row.job_type,
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    requestId: row.request_id,
    state: row.status,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    runAt: row.run_at.toISOString(),
    lockedAt: row.locked_at?.toISOString() ?? null,
    lockedBy: row.locked_by,
    leaseExpiresAt: row.lease_expires_at?.toISOString() ?? null,
    lastError: row.last_error,
    finishedAt: row.finished_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapDatabaseError(error: unknown): Error {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === '42501') return new ForbiddenException('Tenant admin permission is required');
  if (code === '22023') return new BadRequestException('Invalid async reprocessing request');
  if (error instanceof Error) return error;
  return new ConflictException('Async reprocessing could not be completed');
}
