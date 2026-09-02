import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  numeric,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { documents } from './documents.js';
import { users } from './identity.js';
import { tenantMatchesSession } from './rls.js';
import { trips, tripStops } from './trips.js';

export const tripOccurrences = pgTable(
  'trip_occurrences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    tripStopId: uuid('trip_stop_id'),
    occurrenceType: varchar('occurrence_type', { length: 40 }).notNull(),
    severity: varchar('severity', { length: 16 }).default('medium').notNull(),
    status: varchar('status', { length: 16 }).default('open').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    locationText: varchar('location_text', { length: 500 }),
    description: varchar('description', { length: 2000 }).notNull(),
    responsibleUserId: uuid('responsible_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_occurrences_tenant_id_unique').on(table.tenantId, table.id),
    unique('trip_occurrences_tenant_trip_id_unique').on(table.tenantId, table.tripId, table.id),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_occurrences_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripStopId],
      foreignColumns: [tripStops.tenantId, tripStops.tripId, tripStops.id],
      name: 'trip_occurrences_stop_fk',
    }).onDelete('restrict'),
    check(
      'trip_occurrences_type_check',
      sql`${table.occurrenceType} in ('delay','damage','contact_loss','accident','breakdown','route_deviation','cargo_issue','security','documentation','other')`,
    ),
    check(
      'trip_occurrences_severity_check',
      sql`${table.severity} in ('low','medium','high','critical')`,
    ),
    check('trip_occurrences_status_check', sql`${table.status} in ('open','resolved')`),
    check('trip_occurrences_description_check', sql`length(trim(${table.description})) > 0`),
    check(
      'trip_occurrences_coordinates_pair_check',
      sql`(${table.latitude} IS NULL AND ${table.longitude} IS NULL) OR (${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL)`,
    ),
    check(
      'trip_occurrences_latitude_check',
      sql`${table.latitude} IS NULL OR (${table.latitude} >= -90 AND ${table.latitude} <= 90)`,
    ),
    check(
      'trip_occurrences_longitude_check',
      sql`${table.longitude} IS NULL OR (${table.longitude} >= -180 AND ${table.longitude} <= 180)`,
    ),
    check(
      'trip_occurrences_resolution_check',
      sql`(${table.status} = 'open' AND ${table.resolvedAt} IS NULL AND ${table.resolvedByUserId} IS NULL) OR (${table.status} = 'resolved' AND ${table.resolvedAt} IS NOT NULL AND ${table.resolvedByUserId} IS NOT NULL)`,
    ),
    index('trip_occurrences_tenant_trip_status_time_idx').on(
      table.tenantId,
      table.tripId,
      table.status,
      table.occurredAt,
    ),
    index('trip_occurrences_tenant_responsible_status_idx').on(
      table.tenantId,
      table.responsibleUserId,
      table.status,
    ),
    pgPolicy('trip_occurrences_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripOccurrenceHistory = pgTable(
  'trip_occurrence_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    occurrenceId: uuid('occurrence_id').notNull(),
    action: varchar('action', { length: 32 }).notNull(),
    fromStatus: varchar('from_status', { length: 16 }),
    toStatus: varchar('to_status', { length: 16 }),
    responsibleUserId: uuid('responsible_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    note: varchar('note', { length: 2000 }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.occurrenceId],
      foreignColumns: [tripOccurrences.tenantId, tripOccurrences.id],
      name: 'trip_occurrence_history_occurrence_fk',
    }).onDelete('restrict'),
    check(
      'trip_occurrence_history_action_check',
      sql`${table.action} in ('created','treatment','status_changed')`,
    ),
    check(
      'trip_occurrence_history_from_status_check',
      sql`${table.fromStatus} IS NULL OR ${table.fromStatus} in ('open','resolved')`,
    ),
    check(
      'trip_occurrence_history_to_status_check',
      sql`${table.toStatus} IS NULL OR ${table.toStatus} in ('open','resolved')`,
    ),
    check(
      'trip_occurrence_history_payload_check',
      sql`(${table.action} = 'created' AND ${table.fromStatus} IS NULL AND ${table.toStatus} = 'open') OR (${table.action} = 'status_changed' AND ${table.fromStatus} IS NOT NULL AND ${table.toStatus} IS NOT NULL AND ${table.fromStatus} <> ${table.toStatus}) OR (${table.action} = 'treatment' AND length(trim(coalesce(${table.note}, ''))) > 0)`,
    ),
    index('trip_occurrence_history_tenant_occurrence_time_idx').on(
      table.tenantId,
      table.occurrenceId,
      table.createdAt,
    ),
    pgPolicy('trip_occurrence_history_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripOccurrenceDocuments = pgTable(
  'trip_occurrence_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    occurrenceId: uuid('occurrence_id').notNull(),
    documentId: uuid('document_id').notNull(),
    relationType: varchar('relation_type', { length: 24 }).default('evidence').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_occurrence_documents_unique').on(
      table.tenantId,
      table.occurrenceId,
      table.documentId,
      table.relationType,
    ),
    foreignKey({
      columns: [table.tenantId, table.occurrenceId],
      foreignColumns: [tripOccurrences.tenantId, tripOccurrences.id],
      name: 'trip_occurrence_documents_occurrence_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.documentId],
      foreignColumns: [documents.tenantId, documents.id],
      name: 'trip_occurrence_documents_document_fk',
    }).onDelete('restrict'),
    check(
      'trip_occurrence_documents_relation_check',
      sql`${table.relationType} in ('evidence','attachment','other')`,
    ),
    index('trip_occurrence_documents_tenant_occurrence_idx').on(
      table.tenantId,
      table.occurrenceId,
      table.createdAt,
    ),
    pgPolicy('trip_occurrence_documents_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
