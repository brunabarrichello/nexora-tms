import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { transportRequests } from './freight.js';
import { tenantMatchesSession } from './rls.js';

export const transportRequestCargoProfiles = pgTable(
  'transport_request_cargo_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    transportRequestId: uuid('transport_request_id').notNull(),
    material: varchar('material', { length: 200 }).notNull(),
    cargoType: varchar('cargo_type', { length: 120 }).notNull(),
    totalWeightKg: numeric('total_weight_kg', { precision: 14, scale: 3 }).notNull(),
    volumeCount: integer('volume_count').default(0).notNull(),
    palletCount: integer('pallet_count').default(0).notNull(),
    cubageM3: numeric('cubage_m3', { precision: 14, scale: 3 }),
    maxLengthM: numeric('max_length_m', { precision: 10, scale: 3 }),
    maxWidthM: numeric('max_width_m', { precision: 10, scale: 3 }),
    maxHeightM: numeric('max_height_m', { precision: 10, scale: 3 }),
    trackingRequired: boolean('tracking_required').default(false).notNull(),
    vehicleType: varchar('vehicle_type', { length: 80 }).notNull(),
    bodyType: varchar('body_type', { length: 80 }).notNull(),
    nonStackable: boolean('non_stackable').default(false).notNull(),
    specialCargo: boolean('special_cargo').default(false).notNull(),
    specialInstructions: varchar('special_instructions', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('transport_request_cargo_profiles_tenant_request_unique').on(
      table.tenantId,
      table.transportRequestId,
    ),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'transport_request_cargo_profiles_request_fk',
    }).onDelete('cascade'),
    check('transport_request_cargo_profiles_weight_check', sql`${table.totalWeightKg} > 0`),
    check('transport_request_cargo_profiles_volume_count_check', sql`${table.volumeCount} >= 0`),
    check('transport_request_cargo_profiles_pallet_count_check', sql`${table.palletCount} >= 0`),
    check(
      'transport_request_cargo_profiles_package_count_check',
      sql`${table.volumeCount} > 0 OR ${table.palletCount} > 0`,
    ),
    check(
      'transport_request_cargo_profiles_cubage_check',
      sql`${table.cubageM3} IS NULL OR ${table.cubageM3} > 0`,
    ),
    check(
      'transport_request_cargo_profiles_dimensions_check',
      sql`(
        ${table.maxLengthM} IS NULL AND ${table.maxWidthM} IS NULL AND ${table.maxHeightM} IS NULL
      ) OR (
        ${table.maxLengthM} > 0 AND ${table.maxWidthM} > 0 AND ${table.maxHeightM} > 0
      )`,
    ),
    check(
      'transport_request_cargo_profiles_material_check',
      sql`length(trim(${table.material})) > 0`,
    ),
    check(
      'transport_request_cargo_profiles_cargo_type_check',
      sql`length(trim(${table.cargoType})) > 0`,
    ),
    check(
      'transport_request_cargo_profiles_vehicle_type_check',
      sql`length(trim(${table.vehicleType})) > 0`,
    ),
    check(
      'transport_request_cargo_profiles_body_type_check',
      sql`length(trim(${table.bodyType})) > 0`,
    ),
    check(
      'transport_request_cargo_profiles_special_instructions_check',
      sql`NOT ${table.specialCargo} OR length(trim(coalesce(${table.specialInstructions}, ''))) > 0`,
    ),
    index('transport_request_cargo_profiles_tenant_vehicle_idx').on(
      table.tenantId,
      table.vehicleType,
      table.bodyType,
    ),
    index('transport_request_cargo_profiles_tenant_weight_idx').on(
      table.tenantId,
      table.totalWeightKg,
    ),
    pgPolicy('transport_request_cargo_profiles_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
