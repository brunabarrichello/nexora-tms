import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { capacityAssets, drivers } from './capacity.js';
import { transportRequests, transportRequestStops, transportStopTypeEnum } from './freight.js';
import { users } from './identity.js';
import { locations } from './master-data-enrichment.js';
import { tenantMatchesSession } from './rls.js';
import { transportContracts } from './transport-contract.js';

export const tripStatusEnum = pgEnum('trip_status', [
  'planned',
  'ready',
  'in_transit',
  'completed',
  'cancelled',
]);

export const tripStopStatusEnum = pgEnum('trip_stop_status', [
  'planned',
  'arrived',
  'departed',
  'skipped',
  'cancelled',
]);

export const tripDriverRoleEnum = pgEnum('trip_driver_role', ['primary', 'secondary', 'relief']);

export const tripAssetRoleEnum = pgEnum('trip_asset_role', [
  'tractor',
  'vehicle',
  'implement',
  'support',
]);

export const trips = pgTable(
  'trips',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    code: varchar('code', { length: 80 }).notNull(),
    status: tripStatusEnum('status').default('planned').notNull(),
    plannedStartAt: timestamp('planned_start_at', { withTimezone: true }).notNull(),
    plannedEndAt: timestamp('planned_end_at', { withTimezone: true }),
    actualStartAt: timestamp('actual_start_at', { withTimezone: true }),
    actualEndAt: timestamp('actual_end_at', { withTimezone: true }),
    originLocationId: uuid('origin_location_id'),
    destinationLocationId: uuid('destination_location_id'),
    notes: varchar('notes', { length: 1000 }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedByUserId: uuid('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trips_tenant_id_unique').on(table.tenantId, table.id),
    unique('trips_tenant_code_unique').on(table.tenantId, table.code),
    foreignKey({
      columns: [table.tenantId, table.originLocationId],
      foreignColumns: [locations.tenantId, locations.id],
      name: 'trips_origin_location_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.destinationLocationId],
      foreignColumns: [locations.tenantId, locations.id],
      name: 'trips_destination_location_fk',
    }).onDelete('restrict'),
    check('trips_code_check', sql`length(trim(${table.code})) > 0`),
    check(
      'trips_planned_window_check',
      sql`${table.plannedEndAt} IS NULL OR ${table.plannedEndAt} >= ${table.plannedStartAt}`,
    ),
    check(
      'trips_actual_window_check',
      sql`${table.actualEndAt} IS NULL OR (${table.actualStartAt} IS NOT NULL AND ${table.actualEndAt} >= ${table.actualStartAt})`,
    ),
    check(
      'trips_distinct_locations_check',
      sql`${table.originLocationId} IS NULL OR ${table.destinationLocationId} IS NULL OR ${table.originLocationId} <> ${table.destinationLocationId}`,
    ),
    index('trips_tenant_status_start_idx').on(table.tenantId, table.status, table.plannedStartAt),
    index('trips_tenant_origin_idx').on(table.tenantId, table.originLocationId),
    index('trips_tenant_destination_idx').on(table.tenantId, table.destinationLocationId),
    pgPolicy('trips_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripTransportRequests = pgTable(
  'trip_transport_requests',
  {
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    transportRequestId: uuid('transport_request_id').notNull(),
    transportContractId: uuid('transport_contract_id').notNull(),
    sequence: integer('sequence').notNull(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedByUserId: uuid('removed_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    removeReason: varchar('remove_reason', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.tripId, table.transportRequestId],
      name: 'trip_transport_requests_pk',
    }),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_transport_requests_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'trip_transport_requests_request_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId, table.transportContractId],
      foreignColumns: [
        transportContracts.tenantId,
        transportContracts.transportRequestId,
        transportContracts.id,
      ],
      name: 'trip_transport_requests_contract_fk',
    }).onDelete('restrict'),
    check('trip_transport_requests_sequence_check', sql`${table.sequence} > 0`),
    check(
      'trip_transport_requests_removal_check',
      sql`(${table.removedAt} IS NULL AND ${table.removedByUserId} IS NULL AND ${table.removeReason} IS NULL) OR (${table.removedAt} IS NOT NULL AND ${table.removedByUserId} IS NOT NULL AND length(trim(coalesce(${table.removeReason}, ''))) > 0)`,
    ),
    uniqueIndex('trip_transport_requests_active_sequence_unique')
      .on(table.tenantId, table.tripId, table.sequence)
      .where(sql`${table.removedAt} IS NULL`),
    index('trip_transport_requests_request_idx').on(
      table.tenantId,
      table.transportRequestId,
      table.createdAt,
    ),
    index('trip_transport_requests_contract_idx').on(table.tenantId, table.transportContractId),
    pgPolicy('trip_transport_requests_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripStops = pgTable(
  'trip_stops',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    sequence: integer('sequence').notNull(),
    type: transportStopTypeEnum('type').notNull(),
    locationId: uuid('location_id'),
    sourceTransportRequestId: uuid('source_transport_request_id'),
    sourceTransportRequestStopId: uuid('source_transport_request_stop_id'),
    plannedArrivalAt: timestamp('planned_arrival_at', { withTimezone: true }),
    plannedDepartureAt: timestamp('planned_departure_at', { withTimezone: true }),
    actualArrivalAt: timestamp('actual_arrival_at', { withTimezone: true }),
    actualDepartureAt: timestamp('actual_departure_at', { withTimezone: true }),
    status: tripStopStatusEnum('status').default('planned').notNull(),
    instructions: varchar('instructions', { length: 1000 }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedByUserId: uuid('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_stops_tenant_trip_id_unique').on(table.tenantId, table.tripId, table.id),
    unique('trip_stops_tenant_trip_sequence_unique').on(
      table.tenantId,
      table.tripId,
      table.sequence,
    ),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_stops_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.locationId],
      foreignColumns: [locations.tenantId, locations.id],
      name: 'trip_stops_location_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tripId, table.sourceTransportRequestId],
      foreignColumns: [
        tripTransportRequests.tenantId,
        tripTransportRequests.tripId,
        tripTransportRequests.transportRequestId,
      ],
      name: 'trip_stops_trip_request_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.sourceTransportRequestId, table.sourceTransportRequestStopId],
      foreignColumns: [
        transportRequestStops.tenantId,
        transportRequestStops.transportRequestId,
        transportRequestStops.id,
      ],
      name: 'trip_stops_source_stop_fk',
    }).onDelete('restrict'),
    check('trip_stops_sequence_check', sql`${table.sequence} > 0`),
    check(
      'trip_stops_source_pair_check',
      sql`(${table.sourceTransportRequestId} IS NULL AND ${table.sourceTransportRequestStopId} IS NULL) OR (${table.sourceTransportRequestId} IS NOT NULL AND ${table.sourceTransportRequestStopId} IS NOT NULL)`,
    ),
    check(
      'trip_stops_source_check',
      sql`${table.locationId} IS NOT NULL OR ${table.sourceTransportRequestStopId} IS NOT NULL`,
    ),
    check(
      'trip_stops_planned_window_check',
      sql`${table.plannedDepartureAt} IS NULL OR ${table.plannedArrivalAt} IS NULL OR ${table.plannedDepartureAt} >= ${table.plannedArrivalAt}`,
    ),
    check(
      'trip_stops_actual_window_check',
      sql`${table.actualDepartureAt} IS NULL OR (${table.actualArrivalAt} IS NOT NULL AND ${table.actualDepartureAt} >= ${table.actualArrivalAt})`,
    ),
    index('trip_stops_tenant_trip_status_idx').on(
      table.tenantId,
      table.tripId,
      table.status,
      table.sequence,
    ),
    index('trip_stops_tenant_location_idx').on(table.tenantId, table.locationId),
    pgPolicy('trip_stops_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripDrivers = pgTable(
  'trip_drivers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    driverId: uuid('driver_id').notNull(),
    role: tripDriverRoleEnum('role').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedByUserId: uuid('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_drivers_tenant_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_drivers_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'trip_drivers_driver_fk',
    }).onDelete('restrict'),
    check(
      'trip_drivers_period_check',
      sql`${table.endsAt} IS NULL OR ${table.endsAt} >= ${table.startsAt}`,
    ),
    uniqueIndex('trip_drivers_active_driver_unique')
      .on(table.tenantId, table.tripId, table.driverId)
      .where(sql`${table.endsAt} IS NULL`),
    uniqueIndex('trip_drivers_active_primary_unique')
      .on(table.tenantId, table.tripId, table.role)
      .where(sql`${table.endsAt} IS NULL AND ${table.role} = 'primary'`),
    index('trip_drivers_tenant_driver_period_idx').on(
      table.tenantId,
      table.driverId,
      table.startsAt,
    ),
    pgPolicy('trip_drivers_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripAssets = pgTable(
  'trip_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    assetId: uuid('asset_id').notNull(),
    role: tripAssetRoleEnum('role').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedByUserId: uuid('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('trip_assets_tenant_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_assets_trip_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'trip_assets_asset_fk',
    }).onDelete('restrict'),
    check(
      'trip_assets_period_check',
      sql`${table.endsAt} IS NULL OR ${table.endsAt} >= ${table.startsAt}`,
    ),
    uniqueIndex('trip_assets_active_asset_unique')
      .on(table.tenantId, table.tripId, table.assetId)
      .where(sql`${table.endsAt} IS NULL`),
    index('trip_assets_tenant_asset_period_idx').on(table.tenantId, table.assetId, table.startsAt),
    pgPolicy('trip_assets_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tripStatusHistory = pgTable(
  'trip_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tripId: uuid('trip_id').notNull(),
    fromStatus: tripStatusEnum('from_status'),
    toStatus: tripStatusEnum('to_status').notNull(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reason: varchar('reason', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.tripId],
      foreignColumns: [trips.tenantId, trips.id],
      name: 'trip_status_history_trip_fk',
    }).onDelete('restrict'),
    check(
      'trip_status_history_transition_check',
      sql`${table.fromStatus} IS NULL OR ${table.fromStatus} <> ${table.toStatus}`,
    ),
    check(
      'trip_status_history_cancel_reason_check',
      sql`${table.toStatus} <> 'cancelled' OR length(trim(coalesce(${table.reason}, ''))) > 0`,
    ),
    index('trip_status_history_tenant_trip_created_idx').on(
      table.tenantId,
      table.tripId,
      table.createdAt,
    ),
    pgPolicy('trip_status_history_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
