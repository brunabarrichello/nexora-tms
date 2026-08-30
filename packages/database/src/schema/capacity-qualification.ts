import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
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

import { capacityAssets, drivers } from './capacity.js';
import { currencies } from './currency.js';
import { transportRequests } from './freight.js';
import { users } from './identity.js';
import { businessParties } from './master-data.js';
import { tenants } from './platform.js';
import { cities, documentTypes } from './reference-data.js';
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

export const driverDocuments = pgTable(
  'driver_documents',
  {
    ...tenantMutableColumns(),
    driverId: uuid('driver_id').notNull(),
    documentTypeId: uuid('document_type_id').notNull(),
    documentNumber: varchar('document_number', { length: 120 }),
    issuer: varchar('issuer', { length: 180 }),
    issuedOn: date('issued_on'),
    expiresOn: date('expires_on'),
    status: varchar('status', { length: 24 }).default('pending').notNull(),
    validationStatus: varchar('validation_status', { length: 24 }).default('pending').notNull(),
    notes: varchar('notes', { length: 1000 }),
  },
  (table) => [
    unique('driver_documents_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'driver_documents_driver_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.documentTypeId],
      foreignColumns: [documentTypes.tenantId, documentTypes.id],
      name: 'driver_documents_document_type_fk',
    }).onDelete('restrict'),
    check(
      'driver_documents_dates_check',
      sql`${table.issuedOn} IS NULL OR ${table.expiresOn} IS NULL OR ${table.expiresOn} >= ${table.issuedOn}`,
    ),
    check(
      'driver_documents_status_check',
      sql`${table.status} in ('pending','valid','expired','blocked','inactive')`,
    ),
    check(
      'driver_documents_validation_status_check',
      sql`${table.validationStatus} in ('pending','validated','rejected','not_required')`,
    ),
    index('driver_documents_tenant_driver_status_idx').on(
      table.tenantId,
      table.driverId,
      table.status,
    ),
    index('driver_documents_tenant_expiry_idx').on(table.tenantId, table.expiresOn),
    pgPolicy('driver_documents_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const driverQualifications = pgTable(
  'driver_qualifications',
  {
    ...tenantMutableColumns(),
    driverId: uuid('driver_id').notNull(),
    qualificationType: varchar('qualification_type', { length: 64 }).notNull(),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 180 }).notNull(),
    certificateNumber: varchar('certificate_number', { length: 120 }),
    issuer: varchar('issuer', { length: 180 }),
    issuedOn: date('issued_on'),
    expiresOn: date('expires_on'),
    status: varchar('status', { length: 24 }).default('valid').notNull(),
    notes: varchar('notes', { length: 1000 }),
  },
  (table) => [
    unique('driver_qualifications_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('driver_qualifications_tenant_driver_code_unique').on(
      table.tenantId,
      table.driverId,
      table.code,
    ),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'driver_qualifications_driver_fk',
    }).onDelete('restrict'),
    check(
      'driver_qualifications_type_check',
      sql`${table.qualificationType} in ('license','endorsement','certification','authorization','other')`,
    ),
    check('driver_qualifications_code_check', sql`length(trim(${table.code})) > 0`),
    check('driver_qualifications_name_check', sql`length(trim(${table.name})) > 0`),
    check(
      'driver_qualifications_dates_check',
      sql`${table.issuedOn} IS NULL OR ${table.expiresOn} IS NULL OR ${table.expiresOn} >= ${table.issuedOn}`,
    ),
    check(
      'driver_qualifications_status_check',
      sql`${table.status} in ('pending','valid','expired','blocked','inactive')`,
    ),
    index('driver_qualifications_tenant_driver_status_idx').on(
      table.tenantId,
      table.driverId,
      table.status,
    ),
    index('driver_qualifications_tenant_expiry_idx').on(table.tenantId, table.expiresOn),
    pgPolicy('driver_qualifications_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const driverCourses = pgTable(
  'driver_courses',
  {
    ...tenantMutableColumns(),
    driverId: uuid('driver_id').notNull(),
    courseCode: varchar('course_code', { length: 80 }).notNull(),
    courseName: varchar('course_name', { length: 200 }).notNull(),
    provider: varchar('provider', { length: 180 }),
    certificateNumber: varchar('certificate_number', { length: 120 }),
    completedOn: date('completed_on').notNull(),
    expiresOn: date('expires_on'),
    workloadHours: numeric('workload_hours', { precision: 8, scale: 2 }),
    status: varchar('status', { length: 24 }).default('valid').notNull(),
    notes: varchar('notes', { length: 1000 }),
  },
  (table) => [
    unique('driver_courses_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'driver_courses_driver_fk',
    }).onDelete('restrict'),
    check('driver_courses_code_check', sql`length(trim(${table.courseCode})) > 0`),
    check('driver_courses_name_check', sql`length(trim(${table.courseName})) > 0`),
    check(
      'driver_courses_expiry_check',
      sql`${table.expiresOn} IS NULL OR ${table.expiresOn} >= ${table.completedOn}`,
    ),
    check(
      'driver_courses_workload_check',
      sql`${table.workloadHours} IS NULL OR ${table.workloadHours} > 0`,
    ),
    check(
      'driver_courses_status_check',
      sql`${table.status} in ('pending','valid','expired','blocked','inactive')`,
    ),
    index('driver_courses_tenant_driver_status_idx').on(table.tenantId, table.driverId, table.status),
    index('driver_courses_tenant_expiry_idx').on(table.tenantId, table.expiresOn),
    pgPolicy('driver_courses_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const driverAvailability = pgTable(
  'driver_availability',
  {
    ...tenantMutableColumns(),
    driverId: uuid('driver_id').notNull(),
    status: varchar('status', { length: 24 }).default('offline').notNull(),
    availableFrom: timestamp('available_from', { withTimezone: true }),
    availableUntil: timestamp('available_until', { withTimezone: true }),
    currentCityId: uuid('current_city_id').references(() => cities.id, { onDelete: 'restrict' }),
    destinationCityId: uuid('destination_city_id').references(() => cities.id, { onDelete: 'restrict' }),
    maxDistanceKm: numeric('max_distance_km', { precision: 10, scale: 2 }),
    notes: varchar('notes', { length: 500 }),
  },
  (table) => [
    unique('driver_availability_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('driver_availability_tenant_driver_unique').on(table.tenantId, table.driverId),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'driver_availability_driver_fk',
    }).onDelete('cascade'),
    check(
      'driver_availability_status_check',
      sql`${table.status} in ('available','assigned','unavailable','offline')`,
    ),
    check(
      'driver_availability_window_check',
      sql`${table.availableFrom} IS NULL OR ${table.availableUntil} IS NULL OR ${table.availableUntil} >= ${table.availableFrom}`,
    ),
    check(
      'driver_availability_distance_check',
      sql`${table.maxDistanceKm} IS NULL OR ${table.maxDistanceKm} >= 0`,
    ),
    index('driver_availability_tenant_status_city_idx').on(
      table.tenantId,
      table.status,
      table.currentCityId,
    ),
    pgPolicy('driver_availability_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const driverUnavailabilityPeriods = pgTable(
  'driver_unavailability_periods',
  {
    ...tenantMutableColumns(),
    driverId: uuid('driver_id').notNull(),
    reasonCode: varchar('reason_code', { length: 64 }).notNull(),
    reason: varchar('reason', { length: 500 }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 24 }).default('scheduled').notNull(),
  },
  (table) => [
    unique('driver_unavailability_periods_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'driver_unavailability_periods_driver_fk',
    }).onDelete('restrict'),
    check('driver_unavailability_periods_reason_code_check', sql`length(trim(${table.reasonCode})) > 0`),
    check('driver_unavailability_periods_reason_check', sql`length(trim(${table.reason})) > 0`),
    check('driver_unavailability_periods_window_check', sql`${table.endsAt} > ${table.startsAt}`),
    check(
      'driver_unavailability_periods_status_check',
      sql`${table.status} in ('scheduled','active','completed','cancelled')`,
    ),
    index('driver_unavailability_periods_tenant_driver_window_idx').on(
      table.tenantId,
      table.driverId,
      table.startsAt,
      table.endsAt,
    ),
    pgPolicy('driver_unavailability_periods_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const driverEmergencyContacts = pgTable(
  'driver_emergency_contacts',
  {
    ...tenantMutableColumns(),
    driverId: uuid('driver_id').notNull(),
    name: varchar('name', { length: 180 }).notNull(),
    relationship: varchar('relationship', { length: 80 }),
    phone: varchar('phone', { length: 32 }).notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    unique('driver_emergency_contacts_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'driver_emergency_contacts_driver_fk',
    }).onDelete('restrict'),
    check('driver_emergency_contacts_name_check', sql`length(trim(${table.name})) >= 2`),
    check('driver_emergency_contacts_phone_check', sql`length(trim(${table.phone})) >= 8`),
    uniqueIndex('driver_emergency_contacts_primary_unique')
      .on(table.tenantId, table.driverId)
      .where(sql`${table.isPrimary} = true AND ${table.isActive} = true`),
    index('driver_emergency_contacts_tenant_driver_active_idx').on(
      table.tenantId,
      table.driverId,
      table.isActive,
    ),
    pgPolicy('driver_emergency_contacts_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const driverBlocks = pgTable(
  'driver_blocks',
  {
    ...tenantMutableColumns(),
    driverId: uuid('driver_id').notNull(),
    reasonCode: varchar('reason_code', { length: 64 }).notNull(),
    reason: varchar('reason', { length: 1000 }).notNull(),
    severity: varchar('severity', { length: 16 }).default('operational').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).defaultNow().notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releasedByUserId: uuid('released_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    releaseReason: varchar('release_reason', { length: 1000 }),
  },
  (table) => [
    unique('driver_blocks_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'driver_blocks_driver_fk',
    }).onDelete('restrict'),
    check('driver_blocks_reason_code_check', sql`length(trim(${table.reasonCode})) > 0`),
    check('driver_blocks_reason_check', sql`length(trim(${table.reason})) > 0`),
    check(
      'driver_blocks_severity_check',
      sql`${table.severity} in ('operational','compliance','legal','safety')`,
    ),
    check('driver_blocks_period_check', sql`${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`),
    check(
      'driver_blocks_release_check',
      sql`(${table.releasedAt} IS NULL AND ${table.releasedByUserId} IS NULL) OR (${table.releasedAt} IS NOT NULL AND ${table.releasedByUserId} IS NOT NULL AND ${table.releaseReason} IS NOT NULL)`,
    ),
    index('driver_blocks_tenant_driver_active_idx').on(table.tenantId, table.driverId, table.releasedAt),
    pgPolicy('driver_blocks_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const driverRatings = pgTable(
  'driver_ratings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    driverId: uuid('driver_id').notNull(),
    transportRequestId: uuid('transport_request_id'),
    dimension: varchar('dimension', { length: 64 }).notNull(),
    score: numeric('score', { precision: 4, scale: 2 }).notNull(),
    note: varchar('note', { length: 1000 }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'driver_ratings_driver_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'driver_ratings_transport_request_fk',
    }).onDelete('restrict'),
    check('driver_ratings_dimension_check', sql`length(trim(${table.dimension})) > 0`),
    check('driver_ratings_score_check', sql`${table.score} >= 0 AND ${table.score} <= 5`),
    index('driver_ratings_tenant_driver_dimension_time_idx').on(
      table.tenantId,
      table.driverId,
      table.dimension,
      table.createdAt,
    ),
    pgPolicy('driver_ratings_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityAssetCapabilities = pgTable(
  'capacity_asset_capabilities',
  {
    ...tenantMutableColumns(),
    assetId: uuid('asset_id').notNull(),
    refrigerated: boolean('refrigerated').default(false).notNull(),
    sealed: boolean('sealed').default(false).notNull(),
    sideLoading: boolean('side_loading').default(false).notNull(),
    rearLoading: boolean('rear_loading').default(false).notNull(),
    dangerousGoods: boolean('dangerous_goods').default(false).notNull(),
    foodGrade: boolean('food_grade').default(false).notNull(),
    trackingCapable: boolean('tracking_capable').default(false).notNull(),
    maxPallets: integer('max_pallets'),
    minTemperatureC: numeric('min_temperature_c', { precision: 6, scale: 2 }),
    maxTemperatureC: numeric('max_temperature_c', { precision: 6, scale: 2 }),
  },
  (table) => [
    unique('capacity_asset_capabilities_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('capacity_asset_capabilities_tenant_asset_unique').on(table.tenantId, table.assetId),
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_asset_capabilities_asset_fk',
    }).onDelete('cascade'),
    check(
      'capacity_asset_capabilities_pallets_check',
      sql`${table.maxPallets} IS NULL OR ${table.maxPallets} > 0`,
    ),
    check(
      'capacity_asset_capabilities_temperature_check',
      sql`${table.minTemperatureC} IS NULL OR ${table.maxTemperatureC} IS NULL OR ${table.minTemperatureC} <= ${table.maxTemperatureC}`,
    ),
    index('capacity_asset_capabilities_tenant_tracking_idx').on(
      table.tenantId,
      table.trackingCapable,
    ),
    pgPolicy('capacity_asset_capabilities_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityAssetDocuments = pgTable(
  'capacity_asset_documents',
  {
    ...tenantMutableColumns(),
    assetId: uuid('asset_id').notNull(),
    documentTypeId: uuid('document_type_id').notNull(),
    documentNumber: varchar('document_number', { length: 120 }),
    issuer: varchar('issuer', { length: 180 }),
    issuedOn: date('issued_on'),
    expiresOn: date('expires_on'),
    status: varchar('status', { length: 24 }).default('pending').notNull(),
    validationStatus: varchar('validation_status', { length: 24 }).default('pending').notNull(),
    notes: varchar('notes', { length: 1000 }),
  },
  (table) => [
    unique('capacity_asset_documents_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_asset_documents_asset_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.documentTypeId],
      foreignColumns: [documentTypes.tenantId, documentTypes.id],
      name: 'capacity_asset_documents_document_type_fk',
    }).onDelete('restrict'),
    check(
      'capacity_asset_documents_dates_check',
      sql`${table.issuedOn} IS NULL OR ${table.expiresOn} IS NULL OR ${table.expiresOn} >= ${table.issuedOn}`,
    ),
    check(
      'capacity_asset_documents_status_check',
      sql`${table.status} in ('pending','valid','expired','blocked','inactive')`,
    ),
    check(
      'capacity_asset_documents_validation_status_check',
      sql`${table.validationStatus} in ('pending','validated','rejected','not_required')`,
    ),
    index('capacity_asset_documents_tenant_asset_status_idx').on(
      table.tenantId,
      table.assetId,
      table.status,
    ),
    index('capacity_asset_documents_tenant_expiry_idx').on(table.tenantId, table.expiresOn),
    pgPolicy('capacity_asset_documents_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityAssetMaintenancePlans = pgTable(
  'capacity_asset_maintenance_plans',
  {
    ...tenantMutableColumns(),
    assetId: uuid('asset_id').notNull(),
    name: varchar('name', { length: 180 }).notNull(),
    maintenanceType: varchar('maintenance_type', { length: 64 }).notNull(),
    intervalDays: integer('interval_days'),
    intervalOdometerKm: numeric('interval_odometer_km', { precision: 14, scale: 1 }),
    nextDueOn: date('next_due_on'),
    nextDueOdometerKm: numeric('next_due_odometer_km', { precision: 14, scale: 1 }),
    isActive: boolean('is_active').default(true).notNull(),
    notes: varchar('notes', { length: 1000 }),
  },
  (table) => [
    unique('capacity_asset_maintenance_plans_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_asset_maintenance_plans_asset_fk',
    }).onDelete('restrict'),
    check('capacity_asset_maintenance_plans_name_check', sql`length(trim(${table.name})) > 0`),
    check(
      'capacity_asset_maintenance_plans_type_check',
      sql`length(trim(${table.maintenanceType})) > 0`,
    ),
    check(
      'capacity_asset_maintenance_plans_interval_check',
      sql`(${table.intervalDays} IS NOT NULL AND ${table.intervalDays} > 0) OR (${table.intervalOdometerKm} IS NOT NULL AND ${table.intervalOdometerKm} > 0)`,
    ),
    check(
      'capacity_asset_maintenance_plans_next_odometer_check',
      sql`${table.nextDueOdometerKm} IS NULL OR ${table.nextDueOdometerKm} >= 0`,
    ),
    index('capacity_asset_maintenance_plans_tenant_asset_active_idx').on(
      table.tenantId,
      table.assetId,
      table.isActive,
    ),
    index('capacity_asset_maintenance_plans_tenant_due_idx').on(table.tenantId, table.nextDueOn),
    pgPolicy('capacity_asset_maintenance_plans_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityAssetMaintenance = pgTable(
  'capacity_asset_maintenance',
  {
    ...tenantMutableColumns(),
    assetId: uuid('asset_id').notNull(),
    maintenancePlanId: uuid('maintenance_plan_id'),
    providerPartyId: uuid('provider_party_id'),
    maintenanceType: varchar('maintenance_type', { length: 64 }).notNull(),
    status: varchar('status', { length: 24 }).default('planned').notNull(),
    plannedAt: timestamp('planned_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    odometerKm: numeric('odometer_km', { precision: 14, scale: 1 }),
    totalCost: numeric('total_cost', { precision: 18, scale: 2 }),
    currencyId: uuid('currency_id').references(() => currencies.id, { onDelete: 'restrict' }),
    notes: varchar('notes', { length: 1500 }),
  },
  (table) => [
    unique('capacity_asset_maintenance_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_asset_maintenance_asset_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.maintenancePlanId],
      foreignColumns: [capacityAssetMaintenancePlans.tenantId, capacityAssetMaintenancePlans.id],
      name: 'capacity_asset_maintenance_plan_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.providerPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'capacity_asset_maintenance_provider_fk',
    }).onDelete('restrict'),
    check(
      'capacity_asset_maintenance_status_check',
      sql`${table.status} in ('planned','in_progress','completed','cancelled')`,
    ),
    check(
      'capacity_asset_maintenance_odometer_check',
      sql`${table.odometerKm} IS NULL OR ${table.odometerKm} >= 0`,
    ),
    check(
      'capacity_asset_maintenance_cost_check',
      sql`${table.totalCost} IS NULL OR ${table.totalCost} >= 0`,
    ),
    check(
      'capacity_asset_maintenance_currency_check',
      sql`${table.totalCost} IS NULL OR ${table.currencyId} IS NOT NULL`,
    ),
    check(
      'capacity_asset_maintenance_time_check',
      sql`(${table.startedAt} IS NULL OR ${table.plannedAt} IS NULL OR ${table.startedAt} >= ${table.plannedAt}) AND (${table.completedAt} IS NULL OR ${table.startedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt})`,
    ),
    index('capacity_asset_maintenance_tenant_asset_status_idx').on(
      table.tenantId,
      table.assetId,
      table.status,
    ),
    index('capacity_asset_maintenance_tenant_planned_idx').on(table.tenantId, table.plannedAt),
    pgPolicy('capacity_asset_maintenance_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityAssetMaintenanceItems = pgTable(
  'capacity_asset_maintenance_items',
  {
    ...tenantMutableColumns(),
    maintenanceId: uuid('maintenance_id').notNull(),
    itemType: varchar('item_type', { length: 64 }).notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).default('1').notNull(),
    unitAmount: numeric('unit_amount', { precision: 18, scale: 2 }),
    totalAmount: numeric('total_amount', { precision: 18, scale: 2 }),
    currencyId: uuid('currency_id').references(() => currencies.id, { onDelete: 'restrict' }),
  },
  (table) => [
    unique('capacity_asset_maintenance_items_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.maintenanceId],
      foreignColumns: [capacityAssetMaintenance.tenantId, capacityAssetMaintenance.id],
      name: 'capacity_asset_maintenance_items_maintenance_fk',
    }).onDelete('cascade'),
    check('capacity_asset_maintenance_items_quantity_check', sql`${table.quantity} > 0`),
    check(
      'capacity_asset_maintenance_items_amount_check',
      sql`(${table.unitAmount} IS NULL OR ${table.unitAmount} >= 0) AND (${table.totalAmount} IS NULL OR ${table.totalAmount} >= 0)`,
    ),
    check(
      'capacity_asset_maintenance_items_currency_check',
      sql`(${table.unitAmount} IS NULL AND ${table.totalAmount} IS NULL) OR ${table.currencyId} IS NOT NULL`,
    ),
    index('capacity_asset_maintenance_items_tenant_maintenance_idx').on(
      table.tenantId,
      table.maintenanceId,
    ),
    pgPolicy('capacity_asset_maintenance_items_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityAssetInsurances = pgTable(
  'capacity_asset_insurances',
  {
    ...tenantMutableColumns(),
    assetId: uuid('asset_id').notNull(),
    insurerPartyId: uuid('insurer_party_id'),
    policyNumber: varchar('policy_number', { length: 120 }).notNull(),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    coverageAmount: numeric('coverage_amount', { precision: 18, scale: 2 }),
    currencyId: uuid('currency_id').references(() => currencies.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 24 }).default('active').notNull(),
    notes: varchar('notes', { length: 1000 }),
  },
  (table) => [
    unique('capacity_asset_insurances_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('capacity_asset_insurances_tenant_policy_unique').on(table.tenantId, table.policyNumber),
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_asset_insurances_asset_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.insurerPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'capacity_asset_insurances_insurer_fk',
    }).onDelete('restrict'),
    check('capacity_asset_insurances_period_check', sql`${table.endsOn} >= ${table.startsOn}`),
    check(
      'capacity_asset_insurances_coverage_check',
      sql`${table.coverageAmount} IS NULL OR ${table.coverageAmount} >= 0`,
    ),
    check(
      'capacity_asset_insurances_currency_check',
      sql`${table.coverageAmount} IS NULL OR ${table.currencyId} IS NOT NULL`,
    ),
    check(
      'capacity_asset_insurances_status_check',
      sql`${table.status} in ('pending','active','expired','cancelled')`,
    ),
    index('capacity_asset_insurances_tenant_asset_status_idx').on(
      table.tenantId,
      table.assetId,
      table.status,
    ),
    index('capacity_asset_insurances_tenant_expiry_idx').on(table.tenantId, table.endsOn),
    pgPolicy('capacity_asset_insurances_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityAssetInspections = pgTable(
  'capacity_asset_inspections',
  {
    ...tenantMutableColumns(),
    assetId: uuid('asset_id').notNull(),
    inspectionType: varchar('inspection_type', { length: 64 }).notNull(),
    inspectorUserId: uuid('inspector_user_id').references(() => users.id, { onDelete: 'restrict' }),
    performedAt: timestamp('performed_at', { withTimezone: true }).notNull(),
    result: varchar('result', { length: 24 }).notNull(),
    status: varchar('status', { length: 24 }).default('finalized').notNull(),
    checklist: jsonb('checklist').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    notes: varchar('notes', { length: 1500 }),
    nextDueAt: timestamp('next_due_at', { withTimezone: true }),
  },
  (table) => [
    unique('capacity_asset_inspections_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_asset_inspections_asset_fk',
    }).onDelete('restrict'),
    check(
      'capacity_asset_inspections_result_check',
      sql`${table.result} in ('passed','failed','conditional','not_applicable')`,
    ),
    check(
      'capacity_asset_inspections_status_check',
      sql`${table.status} in ('draft','finalized','cancelled')`,
    ),
    check(
      'capacity_asset_inspections_next_due_check',
      sql`${table.nextDueAt} IS NULL OR ${table.nextDueAt} >= ${table.performedAt}`,
    ),
    index('capacity_asset_inspections_tenant_asset_time_idx').on(
      table.tenantId,
      table.assetId,
      table.performedAt,
    ),
    index('capacity_asset_inspections_tenant_due_idx').on(table.tenantId, table.nextDueAt),
    pgPolicy('capacity_asset_inspections_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityAssetAvailability = pgTable(
  'capacity_asset_availability',
  {
    ...tenantMutableColumns(),
    assetId: uuid('asset_id').notNull(),
    status: varchar('status', { length: 24 }).default('offline').notNull(),
    availableFrom: timestamp('available_from', { withTimezone: true }),
    availableUntil: timestamp('available_until', { withTimezone: true }),
    currentCityId: uuid('current_city_id').references(() => cities.id, { onDelete: 'restrict' }),
    notes: varchar('notes', { length: 500 }),
  },
  (table) => [
    unique('capacity_asset_availability_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('capacity_asset_availability_tenant_asset_unique').on(table.tenantId, table.assetId),
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_asset_availability_asset_fk',
    }).onDelete('cascade'),
    check(
      'capacity_asset_availability_status_check',
      sql`${table.status} in ('available','assigned','maintenance','unavailable','offline')`,
    ),
    check(
      'capacity_asset_availability_window_check',
      sql`${table.availableFrom} IS NULL OR ${table.availableUntil} IS NULL OR ${table.availableUntil} >= ${table.availableFrom}`,
    ),
    index('capacity_asset_availability_tenant_status_city_idx').on(
      table.tenantId,
      table.status,
      table.currentCityId,
    ),
    pgPolicy('capacity_asset_availability_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityAssetUnavailabilityPeriods = pgTable(
  'capacity_asset_unavailability_periods',
  {
    ...tenantMutableColumns(),
    assetId: uuid('asset_id').notNull(),
    reasonCode: varchar('reason_code', { length: 64 }).notNull(),
    reason: varchar('reason', { length: 500 }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 24 }).default('scheduled').notNull(),
  },
  (table) => [
    unique('capacity_asset_unavailability_periods_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_asset_unavailability_periods_asset_fk',
    }).onDelete('restrict'),
    check('capacity_asset_unavailability_periods_reason_code_check', sql`length(trim(${table.reasonCode})) > 0`),
    check('capacity_asset_unavailability_periods_reason_check', sql`length(trim(${table.reason})) > 0`),
    check('capacity_asset_unavailability_periods_window_check', sql`${table.endsAt} > ${table.startsAt}`),
    check(
      'capacity_asset_unavailability_periods_status_check',
      sql`${table.status} in ('scheduled','active','completed','cancelled')`,
    ),
    index('capacity_asset_unavailability_periods_tenant_asset_window_idx').on(
      table.tenantId,
      table.assetId,
      table.startsAt,
      table.endsAt,
    ),
    pgPolicy('capacity_asset_unavailability_periods_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityAssetLocations = pgTable(
  'capacity_asset_locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    assetId: uuid('asset_id').notNull(),
    cityId: uuid('city_id').references(() => cities.id, { onDelete: 'restrict' }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: numeric('longitude', { precision: 10, scale: 6 }).notNull(),
    source: varchar('source', { length: 32 }).notNull(),
    accuracyM: numeric('accuracy_m', { precision: 10, scale: 2 }),
    providerReference: varchar('provider_reference', { length: 160 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_asset_locations_asset_fk',
    }).onDelete('restrict'),
    check('capacity_asset_locations_latitude_check', sql`${table.latitude} >= -90 AND ${table.latitude} <= 90`),
    check('capacity_asset_locations_longitude_check', sql`${table.longitude} >= -180 AND ${table.longitude} <= 180`),
    check('capacity_asset_locations_source_check', sql`${table.source} in ('gps','mobile','manual','integration','telematics')`),
    check(
      'capacity_asset_locations_accuracy_check',
      sql`${table.accuracyM} IS NULL OR ${table.accuracyM} >= 0`,
    ),
    index('capacity_asset_locations_tenant_asset_time_idx').on(
      table.tenantId,
      table.assetId,
      table.observedAt,
    ),
    index('capacity_asset_locations_tenant_time_idx').on(table.tenantId, table.observedAt),
    pgPolicy('capacity_asset_locations_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityAssetBlocks = pgTable(
  'capacity_asset_blocks',
  {
    ...tenantMutableColumns(),
    assetId: uuid('asset_id').notNull(),
    reasonCode: varchar('reason_code', { length: 64 }).notNull(),
    reason: varchar('reason', { length: 1000 }).notNull(),
    severity: varchar('severity', { length: 16 }).default('operational').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).defaultNow().notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releasedByUserId: uuid('released_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    releaseReason: varchar('release_reason', { length: 1000 }),
  },
  (table) => [
    unique('capacity_asset_blocks_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_asset_blocks_asset_fk',
    }).onDelete('restrict'),
    check('capacity_asset_blocks_reason_code_check', sql`length(trim(${table.reasonCode})) > 0`),
    check('capacity_asset_blocks_reason_check', sql`length(trim(${table.reason})) > 0`),
    check(
      'capacity_asset_blocks_severity_check',
      sql`${table.severity} in ('operational','compliance','legal','safety','maintenance')`,
    ),
    check('capacity_asset_blocks_period_check', sql`${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`),
    check(
      'capacity_asset_blocks_release_check',
      sql`(${table.releasedAt} IS NULL AND ${table.releasedByUserId} IS NULL) OR (${table.releasedAt} IS NOT NULL AND ${table.releasedByUserId} IS NOT NULL AND ${table.releaseReason} IS NOT NULL)`,
    ),
    index('capacity_asset_blocks_tenant_asset_active_idx').on(table.tenantId, table.assetId, table.releasedAt),
    pgPolicy('capacity_asset_blocks_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
