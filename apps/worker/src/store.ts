import { Pool, type PoolConfig } from 'pg';

import type {
  CommunicationDeliveryPort,
  CommunicationDeliveryTarget,
} from './communication-delivery.js';
import type { WorkerDatabaseConfig } from './config.js';
import type { WebhookDeliveryPort, WebhookDeliveryTarget } from './webhook-delivery.js';

export interface OutboxWorkItem {
  id: string;
  tenant_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  event_version: number;
  payload: unknown;
  attempts: number;
  max_attempts: number;
  correlation_id: string | null;
  request_id: string | null;
  idempotency_key: string;
}

export interface DurableJobWorkItem {
  id: string;
  tenant_id: string;
  source_outbox_event_id: string | null;
  job_type: string;
  payload: unknown;
  attempt: number;
  max_attempts: number;
  correlation_id: string | null;
  request_id: string | null;
  idempotency_key: string;
}

export type FailureStatus = 'retry_wait' | 'dead_lettered' | null;

export interface AsyncStore extends WebhookDeliveryPort, CommunicationDeliveryPort {
  connect(): Promise<{ role: string; database: string }>;
  close(): Promise<void>;
  reapExpiredLeases(workerId: string, batchSize: number): Promise<{ outbox: number; jobs: number }>;
  claimOutbox(workerId: string, batchSize: number, leaseSeconds: number): Promise<OutboxWorkItem[]>;
  claimJobs(
    workerId: string,
    batchSize: number,
    leaseSeconds: number,
  ): Promise<DurableJobWorkItem[]>;
  completeOutbox(id: string, workerId: string): Promise<boolean>;
  completeJob(id: string, workerId: string): Promise<boolean>;
  failOutbox(
    id: string,
    workerId: string,
    error: string,
    baseBackoffSeconds: number,
    maxBackoffSeconds: number,
  ): Promise<FailureStatus>;
  failJob(
    id: string,
    workerId: string,
    error: string,
    baseBackoffSeconds: number,
    maxBackoffSeconds: number,
  ): Promise<FailureStatus>;
}

function databasePoolConfig(database: WorkerDatabaseConfig): PoolConfig {
  if (database.kind === 'url') {
    return { connectionString: database.url };
  }

  return {
    host: database.host,
    port: database.port,
    database: database.database,
    user: database.user,
    password: database.password,
    ssl: { rejectUnauthorized: true },
  };
}

export class PgAsyncStore implements AsyncStore {
  private readonly pool: Pool;

  constructor(database: WorkerDatabaseConfig, maxConnections: number) {
    this.pool = new Pool({
      ...databasePoolConfig(database),
      application_name: 'nexora-tms-worker',
      max: Math.max(2, maxConnections + 2),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  async connect(): Promise<{ role: string; database: string }> {
    const result = await this.pool.query<{ role: string; database: string }>(
      'select current_user as role, current_database() as database',
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Worker database identity query returned no rows');
    }
    if (row.role !== 'nexora_worker') {
      throw new Error(`Worker database identity mismatch: expected nexora_worker, got ${row.role}`);
    }
    return row;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async reapExpiredLeases(
    workerId: string,
    batchSize: number,
  ): Promise<{ outbox: number; jobs: number }> {
    const result = await this.pool.query<{ outbox: number; jobs: number }>(
      `select
         nexora_reap_expired_outbox_leases($1, $2)::integer as outbox,
         nexora_reap_expired_durable_job_leases($1, $2)::integer as jobs`,
      [workerId, batchSize],
    );
    return result.rows[0] ?? { outbox: 0, jobs: 0 };
  }

  async claimOutbox(
    workerId: string,
    batchSize: number,
    leaseSeconds: number,
  ): Promise<OutboxWorkItem[]> {
    const result = await this.pool.query<OutboxWorkItem>(
      'select * from nexora_claim_outbox_events($1, $2, $3)',
      [workerId, batchSize, leaseSeconds],
    );
    return result.rows;
  }

  async claimJobs(
    workerId: string,
    batchSize: number,
    leaseSeconds: number,
  ): Promise<DurableJobWorkItem[]> {
    const result = await this.pool.query<DurableJobWorkItem>(
      'select * from nexora_claim_durable_jobs($1, $2, $3)',
      [workerId, batchSize, leaseSeconds],
    );
    return result.rows;
  }

  async completeOutbox(id: string, workerId: string): Promise<boolean> {
    const result = await this.pool.query<{ completed: boolean }>(
      'select nexora_complete_outbox_event($1, $2) as completed',
      [id, workerId],
    );
    return result.rows[0]?.completed === true;
  }

  async completeJob(id: string, workerId: string): Promise<boolean> {
    const result = await this.pool.query<{ completed: boolean }>(
      'select nexora_complete_durable_job($1, $2) as completed',
      [id, workerId],
    );
    return result.rows[0]?.completed === true;
  }

  async failOutbox(
    id: string,
    workerId: string,
    error: string,
    baseBackoffSeconds: number,
    maxBackoffSeconds: number,
  ): Promise<FailureStatus> {
    const result = await this.pool.query<{ status: FailureStatus }>(
      'select nexora_fail_outbox_event($1, $2, $3, $4, $5) as status',
      [id, workerId, error, baseBackoffSeconds, maxBackoffSeconds],
    );
    return result.rows[0]?.status ?? null;
  }

  async failJob(
    id: string,
    workerId: string,
    error: string,
    baseBackoffSeconds: number,
    maxBackoffSeconds: number,
  ): Promise<FailureStatus> {
    const result = await this.pool.query<{ status: FailureStatus }>(
      'select nexora_fail_durable_job($1, $2, $3, $4, $5) as status',
      [id, workerId, error, baseBackoffSeconds, maxBackoffSeconds],
    );
    return result.rows[0]?.status ?? null;
  }

  async getWebhookDelivery(deliveryId: string): Promise<WebhookDeliveryTarget | null> {
    const result = await this.pool.query<WebhookDeliveryTarget>(
      'select * from nexora_worker_get_webhook_delivery($1::uuid)',
      [deliveryId],
    );
    return result.rows[0] ?? null;
  }

  async recordWebhookAttempt(input: {
    readonly deliveryId: string;
    readonly attempt: number;
    readonly outcome: 'success' | 'failure' | 'cancelled';
    readonly statusCode: number | null;
    readonly durationMs: number;
    readonly errorMessage: string | null;
    readonly terminal: boolean;
  }): Promise<boolean> {
    const result = await this.pool.query<{ recorded: boolean }>(
      `select nexora_worker_record_webhook_attempt(
         $1::uuid,$2::integer,$3::text,$4::integer,$5::integer,$6::text,$7::boolean
       ) as recorded`,
      [
        input.deliveryId,
        input.attempt,
        input.outcome,
        input.statusCode,
        input.durationMs,
        input.errorMessage,
        input.terminal,
      ],
    );
    return result.rows[0]?.recorded === true;
  }

  async getCommunicationDelivery(
    communicationId: string,
  ): Promise<CommunicationDeliveryTarget | null> {
    const result = await this.pool.query<CommunicationDeliveryTarget>(
      'select * from nexora_worker_get_communication($1::uuid)',
      [communicationId],
    );
    return result.rows[0] ?? null;
  }

  async recordCommunicationAttempt(input: {
    readonly communicationId: string;
    readonly jobAttempt: number;
    readonly outcome: 'success' | 'failure' | 'cancelled';
    readonly providerMessageId: string | null;
    readonly statusCode: number | null;
    readonly durationMs: number;
    readonly errorMessage: string | null;
    readonly terminal: boolean;
  }): Promise<boolean> {
    const result = await this.pool.query<{ recorded: boolean }>(
      `select nexora_worker_record_communication_attempt(
         $1::uuid,$2::integer,$3::text,$4::text,$5::integer,$6::integer,$7::text,$8::boolean
       ) as recorded`,
      [
        input.communicationId,
        input.jobAttempt,
        input.outcome,
        input.providerMessageId,
        input.statusCode,
        input.durationMs,
        input.errorMessage,
        input.terminal,
      ],
    );
    return result.rows[0]?.recorded === true;
  }
}
