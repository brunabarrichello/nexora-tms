import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './identity.js';
import { tenantMatchesSession } from './rls.js';

/**
 * Append-only, tenant-scoped audit envelope for cross-cutting business and
 * security events. Mutable domain state should point to an audit event through
 * correlation/request metadata rather than duplicating audit columns in every
 * table.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),

    action: varchar('action', { length: 120 }).notNull(),
    outcome: varchar('outcome', { length: 24 }).default('success').notNull(),
    source: varchar('source', { length: 32 }).default('api').notNull(),

    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: varchar('entity_id', { length: 160 }),

    actorType: varchar('actor_type', { length: 24 }).default('user').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
    actorExternalId: varchar('actor_external_id', { length: 240 }),

    correlationId: varchar('correlation_id', { length: 120 }),
    requestId: varchar('request_id', { length: 120 }),
    idempotencyKey: varchar('idempotency_key', { length: 180 }),

    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 1000 }),
    reason: varchar('reason', { length: 1500 }),

    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('audit_events_tenant_id_unique').on(table.tenantId, table.id),
    check('audit_events_action_check', sql`length(trim(${table.action})) > 0`),
    check('audit_events_entity_type_check', sql`length(trim(${table.entityType})) > 0`),
    check(
      'audit_events_outcome_check',
      sql`${table.outcome} in ('success','failure','denied','partial')`,
    ),
    check(
      'audit_events_source_check',
      sql`${table.source} in ('api','worker','system','integration','migration','admin')`,
    ),
    check(
      'audit_events_actor_type_check',
      sql`${table.actorType} in ('user','service','system','integration','anonymous')`,
    ),
    check(
      'audit_events_user_actor_check',
      sql`${table.actorType} <> 'user' OR ${table.actorUserId} IS NOT NULL`,
    ),
    check(
      'audit_events_non_user_actor_check',
      sql`${table.actorType} = 'user' OR ${table.actorExternalId} IS NOT NULL OR ${table.actorType} in ('system','anonymous')`,
    ),
    index('audit_events_tenant_occurred_idx').on(table.tenantId, table.occurredAt),
    index('audit_events_tenant_entity_idx').on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.occurredAt,
    ),
    index('audit_events_tenant_actor_idx').on(table.tenantId, table.actorUserId, table.occurredAt),
    index('audit_events_tenant_action_idx').on(table.tenantId, table.action, table.occurredAt),
    index('audit_events_tenant_correlation_idx').on(table.tenantId, table.correlationId),
    index('audit_events_tenant_request_idx').on(table.tenantId, table.requestId),
    pgPolicy('audit_events_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

/**
 * Field-level change set attached to an audit event. `sensitive` allows the
 * application to record that a value changed without persisting the secret or
 * personally-sensitive value itself in before/after payloads.
 */
export const auditChanges = pgTable(
  'audit_changes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    auditEventId: uuid('audit_event_id').notNull(),
    fieldPath: varchar('field_path', { length: 300 }).notNull(),
    operation: varchar('operation', { length: 24 }).notNull(),
    beforeValue: jsonb('before_value').$type<unknown>(),
    afterValue: jsonb('after_value').$type<unknown>(),
    sensitive: boolean('sensitive').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.auditEventId],
      foreignColumns: [auditEvents.tenantId, auditEvents.id],
      name: 'audit_changes_event_fk',
    }).onDelete('restrict'),
    check('audit_changes_field_path_check', sql`length(trim(${table.fieldPath})) > 0`),
    check(
      'audit_changes_operation_check',
      sql`${table.operation} in ('set','unset','add','remove','replace')`,
    ),
    check(
      'audit_changes_sensitive_payload_check',
      sql`NOT ${table.sensitive} OR (${table.beforeValue} IS NULL AND ${table.afterValue} IS NULL)`,
    ),
    index('audit_changes_tenant_event_idx').on(table.tenantId, table.auditEventId),
    index('audit_changes_tenant_field_idx').on(table.tenantId, table.fieldPath),
    pgPolicy('audit_changes_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
