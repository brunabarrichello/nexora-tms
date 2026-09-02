import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './platform.js';
import { tenantMatchesSession } from './rls.js';

/**
 * Tenant-scoped transactional outbox. Producers insert an event in the same
 * database transaction that mutates business state. Delivery state is updated
 * only by the asynchronous runtime.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    aggregateType: varchar('aggregate_type', { length: 100 }).notNull(),
    aggregateId: varchar('aggregate_id', { length: 160 }).notNull(),
    eventType: varchar('event_type', { length: 160 }).notNull(),
    eventVersion: integer('event_version').default(1).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 180 }).notNull(),
    correlationId: varchar('correlation_id', { length: 120 }),
    requestId: varchar('request_id', { length: 120 }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(10).notNull(),
    leaseOwner: varchar('lease_owner', { length: 160 }),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    lastError: varchar('last_error', { length: 4000 }),
    deadLetteredAt: timestamp('dead_lettered_at', { withTimezone: true }),
    deadLetterReason: varchar('dead_letter_reason', { length: 2000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('outbox_events_tenant_id_unique').on(table.tenantId, table.id),
    unique('outbox_events_tenant_idempotency_unique').on(table.tenantId, table.idempotencyKey),
    check('outbox_events_aggregate_type_check', sql`length(trim(${table.aggregateType})) > 0`),
    check('outbox_events_aggregate_id_check', sql`length(trim(${table.aggregateId})) > 0`),
    check('outbox_events_event_type_check', sql`length(trim(${table.eventType})) > 0`),
    check('outbox_events_event_version_check', sql`${table.eventVersion} > 0`),
    check('outbox_events_attempts_check', sql`${table.attempts} >= 0`),
    check('outbox_events_max_attempts_check', sql`${table.maxAttempts} > 0`),
    check('outbox_events_attempt_limit_check', sql`${table.attempts} <= ${table.maxAttempts}`),
    check(
      'outbox_events_terminal_state_check',
      sql`NOT (${table.processedAt} IS NOT NULL AND ${table.deadLetteredAt} IS NOT NULL)`,
    ),
    check(
      'outbox_events_lease_pair_check',
      sql`(${table.leaseOwner} IS NULL) = (${table.leaseExpiresAt} IS NULL)`,
    ),
    index('outbox_events_tenant_available_idx').on(table.tenantId, table.availableAt),
    index('outbox_events_pending_idx')
      .on(table.availableAt, table.occurredAt)
      .where(sql`${table.processedAt} IS NULL AND ${table.deadLetteredAt} IS NULL`),
    index('outbox_events_lease_idx')
      .on(table.leaseExpiresAt)
      .where(sql`${table.processedAt} IS NULL AND ${table.deadLetteredAt} IS NULL`),
    index('outbox_events_tenant_correlation_idx').on(table.tenantId, table.correlationId),
    pgPolicy('outbox_events_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

/**
 * Persistent jobs consumed by apps/worker. The row itself is the durable state
 * machine; retries, leases and terminal failure survive process restarts.
 */
export const durableJobs = pgTable(
  'durable_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    sourceOutboxEventId: uuid('source_outbox_event_id'),
    jobType: varchar('job_type', { length: 160 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: varchar('status', { length: 24 }).default('pending').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 180 }).notNull(),
    correlationId: varchar('correlation_id', { length: 120 }),
    requestId: varchar('request_id', { length: 120 }),
    runAt: timestamp('run_at', { withTimezone: true }).defaultNow().notNull(),
    attempt: integer('attempt').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(8).notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: varchar('locked_by', { length: 160 }),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    lastError: varchar('last_error', { length: 4000 }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('durable_jobs_tenant_id_unique').on(table.tenantId, table.id),
    unique('durable_jobs_tenant_idempotency_unique').on(table.tenantId, table.idempotencyKey),
    foreignKey({
      columns: [table.tenantId, table.sourceOutboxEventId],
      foreignColumns: [outboxEvents.tenantId, outboxEvents.id],
      name: 'durable_jobs_source_outbox_fk',
    }).onDelete('restrict'),
    check('durable_jobs_job_type_check', sql`length(trim(${table.jobType})) > 0`),
    check(
      'durable_jobs_status_check',
      sql`${table.status} in ('pending','running','retry_wait','succeeded','dead_lettered','cancelled')`,
    ),
    check('durable_jobs_attempt_check', sql`${table.attempt} >= 0`),
    check('durable_jobs_max_attempts_check', sql`${table.maxAttempts} > 0`),
    check('durable_jobs_attempt_limit_check', sql`${table.attempt} <= ${table.maxAttempts}`),
    check(
      'durable_jobs_lock_pair_check',
      sql`(${table.lockedAt} IS NULL AND ${table.lockedBy} IS NULL AND ${table.leaseExpiresAt} IS NULL) OR (${table.lockedAt} IS NOT NULL AND ${table.lockedBy} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL)`,
    ),
    check(
      'durable_jobs_running_lock_check',
      sql`${table.status} <> 'running' OR (${table.lockedAt} IS NOT NULL AND ${table.lockedBy} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL)`,
    ),
    check(
      'durable_jobs_finished_at_check',
      sql`${table.status} NOT IN ('succeeded','dead_lettered','cancelled') OR ${table.finishedAt} IS NOT NULL`,
    ),
    index('durable_jobs_tenant_status_run_idx').on(table.tenantId, table.status, table.runAt),
    index('durable_jobs_runnable_idx')
      .on(table.runAt, table.createdAt)
      .where(sql`${table.status} in ('pending','retry_wait')`),
    index('durable_jobs_lease_idx')
      .on(table.leaseExpiresAt)
      .where(sql`${table.status} = 'running'`),
    index('durable_jobs_tenant_correlation_idx').on(table.tenantId, table.correlationId),
    pgPolicy('durable_jobs_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
