import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { currencies } from './currency.js';
import { documents } from './documents.js';
import { users } from './identity.js';
import { tenantMatchesSession } from './rls.js';
import { trips, tripStops } from './trips.js';

export const tripEvents = pgTable(
  'trip_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    tripStopId: uuid('trip_stop_id'),
    eventType: varchar('event_type', { length: 40 }).notNull(),
    source: varchar('source', { length: 24 }).default('manual').notNull(),
    title: varchar('title', { length: 180 }).notNull(),
    description: varchar('description', { length: 1500 }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_events_tenant_trip_id_unique').on(table.tenantId, table.tripId, table.id),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_events_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripStopId],
      foreignColumns: [tripStops.tenantId, tripStops.tripId, tripStops.id],
      name: 'trip_events_stop_fk',
    }).onDelete('restrict'),
    check(
      'trip_events_type_check',
      sql`${table.eventType} in ('dispatch','departure','arrival','pickup','delivery','checkpoint','delay','status_change','note','system')`,
    ),
    check(
      'trip_events_source_check',
      sql`${table.source} in ('manual','mobile','system','integration')`,
    ),
    check('trip_events_title_check', sql`length(trim(${table.title})) > 0`),
    index('trip_events_tenant_trip_occurred_idx').on(
      table.tenantId,
      table.tripId,
      table.occurredAt,
    ),
    index('trip_events_tenant_trip_type_idx').on(
      table.tenantId,
      table.tripId,
      table.eventType,
      table.occurredAt,
    ),
    pgPolicy('trip_events_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripCheckins = pgTable(
  'trip_checkins',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    tripStopId: uuid('trip_stop_id').notNull(),
    checkinType: varchar('checkin_type', { length: 24 }).notNull(),
    source: varchar('source', { length: 24 }).default('manual').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    notes: varchar('notes', { length: 1000 }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_checkins_tenant_trip_id_unique').on(table.tenantId, table.tripId, table.id),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_checkins_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripStopId],
      foreignColumns: [tripStops.tenantId, tripStops.tripId, tripStops.id],
      name: 'trip_checkins_stop_fk',
    }).onDelete('restrict'),
    check(
      'trip_checkins_type_check',
      sql`${table.checkinType} in ('arrival','departure','pickup','delivery','checkpoint')`,
    ),
    check(
      'trip_checkins_source_check',
      sql`${table.source} in ('manual','mobile','gps','integration')`,
    ),
    check(
      'trip_checkins_coordinates_pair_check',
      sql`(${table.latitude} IS NULL AND ${table.longitude} IS NULL) OR (${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL)`,
    ),
    check(
      'trip_checkins_latitude_check',
      sql`${table.latitude} IS NULL OR (${table.latitude} >= -90 AND ${table.latitude} <= 90)`,
    ),
    check(
      'trip_checkins_longitude_check',
      sql`${table.longitude} IS NULL OR (${table.longitude} >= -180 AND ${table.longitude} <= 180)`,
    ),
    index('trip_checkins_tenant_trip_stop_time_idx').on(
      table.tenantId,
      table.tripId,
      table.tripStopId,
      table.occurredAt,
    ),
    pgPolicy('trip_checkins_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripLocations = pgTable(
  'trip_locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    tripStopId: uuid('trip_stop_id'),
    source: varchar('source', { length: 24 }).notNull(),
    provider: varchar('provider', { length: 80 }),
    providerEventId: varchar('provider_event_id', { length: 180 }),
    latitude: numeric('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: numeric('longitude', { precision: 9, scale: 6 }).notNull(),
    accuracyM: numeric('accuracy_m', { precision: 10, scale: 2 }),
    speedKmh: numeric('speed_kmh', { precision: 10, scale: 2 }),
    headingDegrees: numeric('heading_degrees', { precision: 6, scale: 2 }),
    etaAt: timestamp('eta_at', { withTimezone: true }),
    etaSource: varchar('eta_source', { length: 24 }),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    staleAfterSeconds: integer('stale_after_seconds').default(900).notNull(),
    retentionUntil: timestamp('retention_until', { withTimezone: true })
      .default(sql`now() + interval '90 days'`)
      .notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_locations_tenant_trip_id_unique').on(table.tenantId, table.tripId, table.id),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_locations_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripStopId],
      foreignColumns: [tripStops.tenantId, tripStops.tripId, tripStops.id],
      name: 'trip_locations_stop_fk',
    }).onDelete('restrict'),
    check(
      'trip_locations_source_check',
      sql`${table.source} in ('manual','mobile','gps','integration')`,
    ),
    check(
      'trip_locations_provider_check',
      sql`${table.source} <> 'integration' OR length(trim(coalesce(${table.provider}, ''))) > 0`,
    ),
    check(
      'trip_locations_latitude_check',
      sql`${table.latitude} >= -90 AND ${table.latitude} <= 90`,
    ),
    check(
      'trip_locations_longitude_check',
      sql`${table.longitude} >= -180 AND ${table.longitude} <= 180`,
    ),
    check(
      'trip_locations_accuracy_check',
      sql`${table.accuracyM} IS NULL OR ${table.accuracyM} >= 0`,
    ),
    check('trip_locations_speed_check', sql`${table.speedKmh} IS NULL OR ${table.speedKmh} >= 0`),
    check(
      'trip_locations_heading_check',
      sql`${table.headingDegrees} IS NULL OR (${table.headingDegrees} >= 0 AND ${table.headingDegrees} < 360)`,
    ),
    check(
      'trip_locations_eta_pair_check',
      sql`(${table.etaAt} IS NULL AND ${table.etaSource} IS NULL) OR (${table.etaAt} IS NOT NULL AND ${table.etaSource} IS NOT NULL)`,
    ),
    check(
      'trip_locations_eta_source_check',
      sql`${table.etaSource} IS NULL OR ${table.etaSource} in ('provider','calculated')`,
    ),
    check(
      'trip_locations_eta_time_check',
      sql`${table.etaAt} IS NULL OR ${table.etaAt} >= ${table.recordedAt}`,
    ),
    check('trip_locations_received_check', sql`${table.receivedAt} >= ${table.recordedAt}`),
    check(
      'trip_locations_stale_after_check',
      sql`${table.staleAfterSeconds} >= 60 AND ${table.staleAfterSeconds} <= 86400`,
    ),
    check('trip_locations_retention_check', sql`${table.retentionUntil} > ${table.receivedAt}`),
    uniqueIndex('trip_locations_provider_event_unique')
      .on(table.tenantId, table.provider, table.providerEventId)
      .where(sql`${table.provider} IS NOT NULL AND ${table.providerEventId} IS NOT NULL`),
    index('trip_locations_tenant_trip_recorded_idx').on(
      table.tenantId,
      table.tripId,
      table.recordedAt,
    ),
    index('trip_locations_retention_idx').on(table.retentionUntil, table.id),
    pgPolicy('trip_locations_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripChecklists = pgTable(
  'trip_checklists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    tripStopId: uuid('trip_stop_id'),
    category: varchar('category', { length: 40 }).notNull(),
    itemCode: varchar('item_code', { length: 80 }).notNull(),
    label: varchar('label', { length: 240 }).notNull(),
    required: boolean('required').default(false).notNull(),
    status: varchar('status', { length: 24 }).default('pending').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedByUserId: uuid('completed_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    waiverReason: varchar('waiver_reason', { length: 1000 }),
    notes: varchar('notes', { length: 1000 }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_checklists_tenant_trip_id_unique').on(table.tenantId, table.tripId, table.id),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_checklists_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripStopId],
      foreignColumns: [tripStops.tenantId, tripStops.tripId, tripStops.id],
      name: 'trip_checklists_stop_fk',
    }).onDelete('restrict'),
    check('trip_checklists_category_check', sql`length(trim(${table.category})) > 0`),
    check('trip_checklists_item_code_check', sql`length(trim(${table.itemCode})) > 0`),
    check('trip_checklists_label_check', sql`length(trim(${table.label})) > 0`),
    check(
      'trip_checklists_status_check',
      sql`${table.status} in ('pending','completed','waived','failed')`,
    ),
    check(
      'trip_checklists_completion_check',
      sql`(${table.status} = 'pending' AND ${table.completedAt} IS NULL AND ${table.completedByUserId} IS NULL) OR (${table.status} <> 'pending' AND ${table.completedAt} IS NOT NULL AND ${table.completedByUserId} IS NOT NULL)`,
    ),
    check(
      'trip_checklists_waiver_check',
      sql`${table.status} <> 'waived' OR length(trim(coalesce(${table.waiverReason}, ''))) > 0`,
    ),
    index('trip_checklists_tenant_trip_status_idx').on(table.tenantId, table.tripId, table.status),
    index('trip_checklists_tenant_trip_stop_idx').on(
      table.tenantId,
      table.tripId,
      table.tripStopId,
    ),
    pgPolicy('trip_checklists_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripDocuments = pgTable(
  'trip_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    tripStopId: uuid('trip_stop_id'),
    documentId: uuid('document_id').notNull(),
    relationType: varchar('relation_type', { length: 32 }).default('execution').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_documents_tenant_trip_id_unique').on(table.tenantId, table.tripId, table.id),
    unique('trip_documents_tenant_trip_document_relation_unique').on(
      table.tenantId,
      table.tripId,
      table.documentId,
      table.relationType,
    ),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_documents_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripStopId],
      foreignColumns: [tripStops.tenantId, tripStops.tripId, tripStops.id],
      name: 'trip_documents_stop_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.documentId],
      foreignColumns: [documents.tenantId, documents.id],
      name: 'trip_documents_document_fk',
    }).onDelete('restrict'),
    check(
      'trip_documents_relation_check',
      sql`${table.relationType} in ('execution','pickup_proof','delivery_proof','expense_receipt','toll_receipt','fuel_receipt','checklist_evidence','other')`,
    ),
    index('trip_documents_tenant_trip_relation_idx').on(
      table.tenantId,
      table.tripId,
      table.relationType,
      table.createdAt,
    ),
    pgPolicy('trip_documents_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripExpenses = pgTable(
  'trip_expenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    tripStopId: uuid('trip_stop_id'),
    tripDocumentId: uuid('trip_document_id'),
    category: varchar('category', { length: 32 }).notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    currencyId: uuid('currency_id')
      .notNull()
      .references(() => currencies.id, { onDelete: 'restrict' }),
    incurredAt: timestamp('incurred_at', { withTimezone: true }).notNull(),
    merchant: varchar('merchant', { length: 180 }),
    externalReference: varchar('external_reference', { length: 180 }),
    description: varchar('description', { length: 1000 }),
    status: varchar('status', { length: 24 }).default('reported').notNull(),
    reportedByUserId: uuid('reported_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewReason: varchar('review_reason', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_expenses_tenant_trip_id_unique').on(table.tenantId, table.tripId, table.id),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_expenses_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripStopId],
      foreignColumns: [tripStops.tenantId, tripStops.tripId, tripStops.id],
      name: 'trip_expenses_stop_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripDocumentId],
      foreignColumns: [tripDocuments.tenantId, tripDocuments.tripId, tripDocuments.id],
      name: 'trip_expenses_document_fk',
    }).onDelete('restrict'),
    check(
      'trip_expenses_category_check',
      sql`${table.category} in ('parking','meal','lodging','repair','loading','unloading','other')`,
    ),
    check('trip_expenses_amount_check', sql`${table.amount} > 0`),
    check(
      'trip_expenses_status_check',
      sql`${table.status} in ('reported','approved','rejected','voided')`,
    ),
    check(
      'trip_expenses_review_check',
      sql`(${table.status} = 'reported' AND ${table.reviewedByUserId} IS NULL AND ${table.reviewedAt} IS NULL) OR (${table.status} <> 'reported' AND ${table.reviewedByUserId} IS NOT NULL AND ${table.reviewedAt} IS NOT NULL)`,
    ),
    check(
      'trip_expenses_rejection_reason_check',
      sql`${table.status} NOT IN ('rejected','voided') OR length(trim(coalesce(${table.reviewReason}, ''))) > 0`,
    ),
    index('trip_expenses_tenant_trip_time_idx').on(table.tenantId, table.tripId, table.incurredAt),
    index('trip_expenses_tenant_trip_status_idx').on(table.tenantId, table.tripId, table.status),
    pgPolicy('trip_expenses_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripTolls = pgTable(
  'trip_tolls',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    tripStopId: uuid('trip_stop_id'),
    tripDocumentId: uuid('trip_document_id'),
    plaza: varchar('plaza', { length: 180 }).notNull(),
    road: varchar('road', { length: 120 }),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    currencyId: uuid('currency_id')
      .notNull()
      .references(() => currencies.id, { onDelete: 'restrict' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    paymentMethod: varchar('payment_method', { length: 24 }).notNull(),
    tagReference: varchar('tag_reference', { length: 120 }),
    notes: varchar('notes', { length: 1000 }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_tolls_tenant_trip_id_unique').on(table.tenantId, table.tripId, table.id),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_tolls_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripStopId],
      foreignColumns: [tripStops.tenantId, tripStops.tripId, tripStops.id],
      name: 'trip_tolls_stop_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripDocumentId],
      foreignColumns: [tripDocuments.tenantId, tripDocuments.tripId, tripDocuments.id],
      name: 'trip_tolls_document_fk',
    }).onDelete('restrict'),
    check('trip_tolls_plaza_check', sql`length(trim(${table.plaza})) > 0`),
    check('trip_tolls_amount_check', sql`${table.amount} > 0`),
    check(
      'trip_tolls_payment_method_check',
      sql`${table.paymentMethod} in ('cash','tag','card','invoice','other')`,
    ),
    index('trip_tolls_tenant_trip_time_idx').on(table.tenantId, table.tripId, table.occurredAt),
    pgPolicy('trip_tolls_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripFuel = pgTable(
  'trip_fuel',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    tripStopId: uuid('trip_stop_id'),
    tripDocumentId: uuid('trip_document_id'),
    fuelType: varchar('fuel_type', { length: 24 }).notNull(),
    liters: numeric('liters', { precision: 12, scale: 3 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 14, scale: 4 }).notNull(),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull(),
    currencyId: uuid('currency_id')
      .notNull()
      .references(() => currencies.id, { onDelete: 'restrict' }),
    odometerKm: numeric('odometer_km', { precision: 14, scale: 1 }),
    station: varchar('station', { length: 180 }),
    fueledAt: timestamp('fueled_at', { withTimezone: true }).notNull(),
    notes: varchar('notes', { length: 1000 }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_fuel_tenant_trip_id_unique').on(table.tenantId, table.tripId, table.id),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_fuel_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripStopId],
      foreignColumns: [tripStops.tenantId, tripStops.tripId, tripStops.id],
      name: 'trip_fuel_stop_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripDocumentId],
      foreignColumns: [tripDocuments.tenantId, tripDocuments.tripId, tripDocuments.id],
      name: 'trip_fuel_document_fk',
    }).onDelete('restrict'),
    check(
      'trip_fuel_type_check',
      sql`${table.fuelType} in ('diesel','gasoline','ethanol','cng','electric','other')`,
    ),
    check('trip_fuel_liters_check', sql`${table.liters} > 0`),
    check('trip_fuel_unit_price_check', sql`${table.unitPrice} > 0`),
    check('trip_fuel_total_amount_check', sql`${table.totalAmount} > 0`),
    check('trip_fuel_odometer_check', sql`${table.odometerKm} IS NULL OR ${table.odometerKm} >= 0`),
    index('trip_fuel_tenant_trip_time_idx').on(table.tenantId, table.tripId, table.fueledAt),
    pgPolicy('trip_fuel_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripProofs = pgTable(
  'trip_proofs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    tripStopId: uuid('trip_stop_id'),
    tripDocumentId: uuid('trip_document_id').notNull(),
    proofType: varchar('proof_type', { length: 32 }).notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    capturedByUserId: uuid('captured_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    source: varchar('source', { length: 24 }).default('manual').notNull(),
    notes: varchar('notes', { length: 1000 }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_proofs_tenant_trip_id_unique').on(table.tenantId, table.tripId, table.id),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_proofs_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripStopId],
      foreignColumns: [tripStops.tenantId, tripStops.tripId, tripStops.id],
      name: 'trip_proofs_stop_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripDocumentId],
      foreignColumns: [tripDocuments.tenantId, tripDocuments.tripId, tripDocuments.id],
      name: 'trip_proofs_document_fk',
    }).onDelete('restrict'),
    check(
      'trip_proofs_type_check',
      sql`${table.proofType} in ('pickup','delivery','seal','weight','checklist','other')`,
    ),
    check(
      'trip_proofs_source_check',
      sql`${table.source} in ('manual','mobile','integration','generated')`,
    ),
    index('trip_proofs_tenant_trip_type_time_idx').on(
      table.tenantId,
      table.tripId,
      table.proofType,
      table.capturedAt,
    ),
    pgPolicy('trip_proofs_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripDeliveryProofs = pgTable(
  'trip_delivery_proofs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    tripStopId: uuid('trip_stop_id').notNull(),
    tripProofId: uuid('trip_proof_id').notNull(),
    receivedByName: varchar('received_by_name', { length: 180 }).notNull(),
    receivedByRole: varchar('received_by_role', { length: 120 }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 24 }).default('recorded').notNull(),
    exceptionReason: varchar('exception_reason', { length: 1000 }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_delivery_proofs_tenant_trip_id_unique').on(table.tenantId, table.tripId, table.id),
    unique('trip_delivery_proofs_tenant_trip_proof_unique').on(
      table.tenantId,
      table.tripId,
      table.tripProofId,
    ),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_delivery_proofs_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripStopId],
      foreignColumns: [tripStops.tenantId, tripStops.tripId, tripStops.id],
      name: 'trip_delivery_proofs_stop_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.tripProofId],
      foreignColumns: [tripProofs.tenantId, tripProofs.tripId, tripProofs.id],
      name: 'trip_delivery_proofs_proof_fk',
    }).onDelete('restrict'),
    check('trip_delivery_proofs_receiver_check', sql`length(trim(${table.receivedByName})) > 0`),
    check(
      'trip_delivery_proofs_status_check',
      sql`${table.status} in ('recorded','accepted','rejected')`,
    ),
    check(
      'trip_delivery_proofs_exception_check',
      sql`${table.status} <> 'rejected' OR length(trim(coalesce(${table.exceptionReason}, ''))) > 0`,
    ),
    index('trip_delivery_proofs_tenant_trip_delivered_idx').on(
      table.tenantId,
      table.tripId,
      table.deliveredAt,
    ),
    pgPolicy('trip_delivery_proofs_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
