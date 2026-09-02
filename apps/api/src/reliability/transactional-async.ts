import type { TenantQueryClient } from '../tenancy/tenant-database.service.js';

export interface OutboxEventInput {
  readonly tenantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly eventVersion?: number;
  readonly correlationId?: string | null;
  readonly requestId?: string | null;
  readonly availableAt?: string | Date | null;
  readonly maxAttempts?: number;
}

export interface DurableJobInput {
  readonly tenantId: string;
  readonly jobType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly sourceOutboxEventId?: string | null;
  readonly correlationId?: string | null;
  readonly requestId?: string | null;
  readonly runAt?: string | Date | null;
  readonly maxAttempts?: number;
}

/**
 * Appends an outbox row using the caller's existing PostgreSQL transaction.
 * This helper deliberately does not acquire a connection and does not issue
 * BEGIN/COMMIT so functional state and async intent can be committed atomically.
 */
export async function appendOutboxEvent(
  client: TenantQueryClient,
  input: OutboxEventInput,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO outbox_events (
       tenant_id,aggregate_type,aggregate_id,event_type,event_version,payload,
       idempotency_key,correlation_id,request_id,available_at,max_attempts
     ) VALUES (
       $1::uuid,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,coalesce($10::timestamptz,now()),$11
     )
     RETURNING id::text AS id`,
    [
      input.tenantId,
      requireNonEmpty(input.aggregateType, 'aggregateType'),
      requireNonEmpty(input.aggregateId, 'aggregateId'),
      requireNonEmpty(input.eventType, 'eventType'),
      requirePositiveInteger(input.eventVersion ?? 1, 'eventVersion'),
      JSON.stringify(input.payload),
      requireNonEmpty(input.idempotencyKey, 'idempotencyKey'),
      input.correlationId ?? null,
      input.requestId ?? null,
      input.availableAt ?? null,
      requirePositiveInteger(input.maxAttempts ?? 10, 'maxAttempts'),
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error('Outbox event insert did not return an id');
  }
  return id;
}

/**
 * Persists a durable job inside the caller's transaction. Runtime claiming and
 * execution belong to apps/worker (NEX-91); this function only records intent.
 */
export async function enqueueDurableJob(
  client: TenantQueryClient,
  input: DurableJobInput,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO durable_jobs (
       tenant_id,source_outbox_event_id,job_type,payload,idempotency_key,
       correlation_id,request_id,run_at,max_attempts
     ) VALUES (
       $1::uuid,$2::uuid,$3,$4::jsonb,$5,$6,$7,coalesce($8::timestamptz,now()),$9
     )
     RETURNING id::text AS id`,
    [
      input.tenantId,
      input.sourceOutboxEventId ?? null,
      requireNonEmpty(input.jobType, 'jobType'),
      JSON.stringify(input.payload),
      requireNonEmpty(input.idempotencyKey, 'idempotencyKey'),
      input.correlationId ?? null,
      input.requestId ?? null,
      input.runAt ?? null,
      requirePositiveInteger(input.maxAttempts ?? 8, 'maxAttempts'),
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error('Durable job insert did not return an id');
  }
  return id;
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} must not be empty`);
  }
  return normalized;
}

function requirePositiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}
