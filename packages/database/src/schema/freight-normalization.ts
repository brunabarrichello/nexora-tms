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
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './identity.js';
import { businessParties } from './master-data.js';
import { commodities } from './master-data-enrichment.js';
import { tenants } from './platform.js';
import {
  bodyTypes,
  cargoTypes,
  cities,
  packageTypes,
  unitsOfMeasure,
  vehicleTypes,
} from './reference-data.js';
import { transportRequests, transportRequestStatusEnum } from './freight.js';
import { tenantMatchesSession } from './rls.js';

function tenantMutableColumns() {
  return {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedByUserId: uuid('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  };
}

export const transportRequestItems = pgTable(
  'transport_request_items',
  {
    ...tenantMutableColumns(),
    transportRequestId: uuid('transport_request_id').notNull(),
    sequence: integer('sequence').notNull(),
    commodityId: uuid('commodity_id'),
    cargoTypeId: uuid('cargo_type_id'),
    sku: varchar('sku', { length: 120 }),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).default('1').notNull(),
    unitOfMeasureId: uuid('unit_of_measure_id'),
    totalWeightKg: numeric('total_weight_kg', { precision: 14, scale: 3 }),
    totalVolumeM3: numeric('total_volume_m3', { precision: 14, scale: 3 }),
    hazardous: boolean('hazardous').default(false).notNull(),
    minTemperatureC: numeric('min_temperature_c', { precision: 6, scale: 2 }),
    maxTemperatureC: numeric('max_temperature_c', { precision: 6, scale: 2 }),
    stackable: boolean('stackable'),
    notes: varchar('notes', { length: 1000 }),
  },
  (table) => [
    unique('transport_request_items_tenant_request_id_unique').on(
      table.tenantId,
      table.transportRequestId,
      table.id,
    ),
    unique('transport_request_items_tenant_request_sequence_unique').on(
      table.tenantId,
      table.transportRequestId,
      table.sequence,
    ),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'transport_request_items_request_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.commodityId],
      foreignColumns: [commodities.tenantId, commodities.id],
      name: 'transport_request_items_commodity_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.cargoTypeId],
      foreignColumns: [cargoTypes.tenantId, cargoTypes.id],
      name: 'transport_request_items_cargo_type_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.unitOfMeasureId],
      foreignColumns: [unitsOfMeasure.id],
      name: 'transport_request_items_uom_fk',
    }).onDelete('restrict'),
    check('transport_request_items_sequence_check', sql`${table.sequence} > 0`),
    check('transport_request_items_description_check', sql`length(trim(${table.description})) > 0`),
    check('transport_request_items_quantity_check', sql`${table.quantity} > 0`),
    check(
      'transport_request_items_weight_check',
      sql`${table.totalWeightKg} IS NULL OR ${table.totalWeightKg} > 0`,
    ),
    check(
      'transport_request_items_volume_check',
      sql`${table.totalVolumeM3} IS NULL OR ${table.totalVolumeM3} > 0`,
    ),
    check(
      'transport_request_items_temperature_check',
      sql`${table.minTemperatureC} IS NULL OR ${table.maxTemperatureC} IS NULL OR ${table.minTemperatureC} <= ${table.maxTemperatureC}`,
    ),
    index('transport_request_items_tenant_request_idx').on(
      table.tenantId,
      table.transportRequestId,
    ),
    index('transport_request_items_tenant_commodity_idx').on(table.tenantId, table.commodityId),
    pgPolicy('transport_request_items_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const transportRequestPackages = pgTable(
  'transport_request_packages',
  {
    ...tenantMutableColumns(),
    transportRequestId: uuid('transport_request_id').notNull(),
    itemId: uuid('item_id'),
    sequence: integer('sequence').notNull(),
    packageTypeId: uuid('package_type_id'),
    quantity: integer('quantity').default(1).notNull(),
    weightKg: numeric('weight_kg', { precision: 14, scale: 3 }),
    lengthM: numeric('length_m', { precision: 10, scale: 3 }),
    widthM: numeric('width_m', { precision: 10, scale: 3 }),
    heightM: numeric('height_m', { precision: 10, scale: 3 }),
    stackable: boolean('stackable'),
    label: varchar('label', { length: 160 }),
    barcode: varchar('barcode', { length: 160 }),
    notes: varchar('notes', { length: 1000 }),
  },
  (table) => [
    unique('transport_request_packages_tenant_request_id_unique').on(
      table.tenantId,
      table.transportRequestId,
      table.id,
    ),
    unique('transport_request_packages_tenant_request_sequence_unique').on(
      table.tenantId,
      table.transportRequestId,
      table.sequence,
    ),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'transport_request_packages_request_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId, table.itemId],
      foreignColumns: [
        transportRequestItems.tenantId,
        transportRequestItems.transportRequestId,
        transportRequestItems.id,
      ],
      name: 'transport_request_packages_item_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.packageTypeId],
      foreignColumns: [packageTypes.tenantId, packageTypes.id],
      name: 'transport_request_packages_package_type_fk',
    }).onDelete('restrict'),
    check('transport_request_packages_sequence_check', sql`${table.sequence} > 0`),
    check('transport_request_packages_quantity_check', sql`${table.quantity} > 0`),
    check(
      'transport_request_packages_weight_check',
      sql`${table.weightKg} IS NULL OR ${table.weightKg} > 0`,
    ),
    check(
      'transport_request_packages_dimensions_check',
      sql`(
        ${table.lengthM} IS NULL AND ${table.widthM} IS NULL AND ${table.heightM} IS NULL
      ) OR (
        ${table.lengthM} > 0 AND ${table.widthM} > 0 AND ${table.heightM} > 0
      )`,
    ),
    index('transport_request_packages_tenant_request_idx').on(
      table.tenantId,
      table.transportRequestId,
    ),
    index('transport_request_packages_tenant_item_idx').on(table.tenantId, table.itemId),
    pgPolicy('transport_request_packages_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const transportRequestRequirements = pgTable(
  'transport_request_requirements',
  {
    ...tenantMutableColumns(),
    transportRequestId: uuid('transport_request_id').notNull(),
    code: varchar('code', { length: 80 }).notNull(),
    requirementType: varchar('requirement_type', { length: 32 }).notNull(),
    vehicleTypeId: uuid('vehicle_type_id'),
    bodyTypeId: uuid('body_type_id'),
    required: boolean('required').default(true).notNull(),
    valueText: varchar('value_text', { length: 500 }),
    valueNumeric: numeric('value_numeric', { precision: 14, scale: 3 }),
    valueBoolean: boolean('value_boolean'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    notes: varchar('notes', { length: 1000 }),
  },
  (table) => [
    unique('transport_request_requirements_tenant_request_code_unique').on(
      table.tenantId,
      table.transportRequestId,
      table.code,
    ),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'transport_request_requirements_request_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.vehicleTypeId],
      foreignColumns: [vehicleTypes.tenantId, vehicleTypes.id],
      name: 'transport_request_requirements_vehicle_type_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.bodyTypeId],
      foreignColumns: [bodyTypes.tenantId, bodyTypes.id],
      name: 'transport_request_requirements_body_type_fk',
    }).onDelete('restrict'),
    check('transport_request_requirements_code_check', sql`length(trim(${table.code})) > 0`),
    check(
      'transport_request_requirements_type_check',
      sql`${table.requirementType} in ('vehicle_type','body_type','tracking','temperature_min','temperature_max','handling','certification','equipment','insurance','other')`,
    ),
    check(
      'transport_request_requirements_vehicle_type_check',
      sql`${table.requirementType} <> 'vehicle_type' OR (${table.vehicleTypeId} IS NOT NULL AND ${table.bodyTypeId} IS NULL)`,
    ),
    check(
      'transport_request_requirements_body_type_check',
      sql`${table.requirementType} <> 'body_type' OR (${table.bodyTypeId} IS NOT NULL AND ${table.vehicleTypeId} IS NULL)`,
    ),
    check(
      'transport_request_requirements_tracking_check',
      sql`${table.requirementType} <> 'tracking' OR ${table.valueBoolean} IS NOT NULL`,
    ),
    check(
      'transport_request_requirements_temperature_check',
      sql`${table.requirementType} NOT IN ('temperature_min','temperature_max') OR ${table.valueNumeric} IS NOT NULL`,
    ),
    index('transport_request_requirements_tenant_request_type_idx').on(
      table.tenantId,
      table.transportRequestId,
      table.requirementType,
    ),
    pgPolicy('transport_request_requirements_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const transportRequestReferences = pgTable(
  'transport_request_references',
  {
    ...tenantMutableColumns(),
    transportRequestId: uuid('transport_request_id').notNull(),
    referenceType: varchar('reference_type', { length: 32 }).notNull(),
    value: varchar('value', { length: 180 }).notNull(),
    issuerPartyId: uuid('issuer_party_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
  },
  (table) => [
    unique('transport_request_references_tenant_request_type_value_unique').on(
      table.tenantId,
      table.transportRequestId,
      table.referenceType,
      table.value,
    ),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'transport_request_references_request_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.issuerPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'transport_request_references_issuer_party_fk',
    }).onDelete('restrict'),
    check(
      'transport_request_references_type_check',
      sql`${table.referenceType} in ('customer_order','purchase_order','invoice','shipment','booking','tracking','external','other')`,
    ),
    check('transport_request_references_value_check', sql`length(trim(${table.value})) > 0`),
    index('transport_request_references_tenant_request_type_idx').on(
      table.tenantId,
      table.transportRequestId,
      table.referenceType,
    ),
    pgPolicy('transport_request_references_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const transportRequestStatusHistory = pgTable(
  'transport_request_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    transportRequestId: uuid('transport_request_id').notNull(),
    fromStatus: transportRequestStatusEnum('from_status'),
    toStatus: transportRequestStatusEnum('to_status').notNull(),
    reason: varchar('reason', { length: 1000 }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    snapshot: jsonb('snapshot')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('transport_request_status_history_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'transport_request_status_history_request_fk',
    }).onDelete('cascade'),
    check(
      'transport_request_status_history_transition_check',
      sql`${table.fromStatus} IS NULL OR ${table.fromStatus} <> ${table.toStatus}`,
    ),
    index('transport_request_status_history_tenant_request_created_idx').on(
      table.tenantId,
      table.transportRequestId,
      table.createdAt,
    ),
    pgPolicy('transport_request_status_history_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const transportRequestEvents = pgTable(
  'transport_request_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    transportRequestId: uuid('transport_request_id').notNull(),
    eventType: varchar('event_type', { length: 80 }).notNull(),
    source: varchar('source', { length: 32 }).default('system').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
    correlationId: uuid('correlation_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('transport_request_events_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'transport_request_events_request_fk',
    }).onDelete('cascade'),
    check('transport_request_events_type_check', sql`length(trim(${table.eventType})) > 0`),
    check(
      'transport_request_events_source_check',
      sql`${table.source} in ('user','system','integration','worker')`,
    ),
    index('transport_request_events_tenant_request_occurred_idx').on(
      table.tenantId,
      table.transportRequestId,
      table.occurredAt,
    ),
    index('transport_request_events_tenant_type_occurred_idx').on(
      table.tenantId,
      table.eventType,
      table.occurredAt,
    ),
    pgPolicy('transport_request_events_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const freightLanes = pgTable(
  'freight_lanes',
  {
    ...tenantMutableColumns(),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 180 }).notNull(),
    originCityId: uuid('origin_city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'restrict' }),
    destinationCityId: uuid('destination_city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'restrict' }),
    originRadiusKm: numeric('origin_radius_km', { precision: 10, scale: 2 }),
    destinationRadiusKm: numeric('destination_radius_km', { precision: 10, scale: 2 }),
    distanceKm: numeric('distance_km', { precision: 12, scale: 2 }),
    typicalTransitHours: numeric('typical_transit_hours', { precision: 10, scale: 2 }),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    unique('freight_lanes_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('freight_lanes_tenant_code_unique').on(table.tenantId, table.code),
    check('freight_lanes_code_check', sql`length(trim(${table.code})) > 0`),
    check('freight_lanes_name_check', sql`length(trim(${table.name})) > 0`),
    check(
      'freight_lanes_distinct_cities_check',
      sql`${table.originCityId} <> ${table.destinationCityId}`,
    ),
    check(
      'freight_lanes_origin_radius_check',
      sql`${table.originRadiusKm} IS NULL OR ${table.originRadiusKm} >= 0`,
    ),
    check(
      'freight_lanes_destination_radius_check',
      sql`${table.destinationRadiusKm} IS NULL OR ${table.destinationRadiusKm} >= 0`,
    ),
    check(
      'freight_lanes_distance_check',
      sql`${table.distanceKm} IS NULL OR ${table.distanceKm} > 0`,
    ),
    check(
      'freight_lanes_transit_check',
      sql`${table.typicalTransitHours} IS NULL OR ${table.typicalTransitHours} > 0`,
    ),
    index('freight_lanes_tenant_route_active_idx').on(
      table.tenantId,
      table.originCityId,
      table.destinationCityId,
      table.isActive,
    ),
    pgPolicy('freight_lanes_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
