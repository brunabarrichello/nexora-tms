import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  numeric,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './platform.js';
import { tenantMatchesSession } from './rls.js';

export const countries = pgTable(
  'countries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 2 }).notNull(),
    iso3: varchar('iso3', { length: 3 }).notNull(),
    numericCode: varchar('numeric_code', { length: 3 }),
    name: varchar('name', { length: 120 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('countries_code_unique').on(table.code),
    unique('countries_iso3_unique').on(table.iso3),
    unique('countries_numeric_code_unique').on(table.numericCode),
    check('countries_code_check', sql`${table.code} ~ '^[A-Z]{2}$'`),
    check('countries_iso3_check', sql`${table.iso3} ~ '^[A-Z]{3}$'`),
    check(
      'countries_numeric_code_check',
      sql`${table.numericCode} IS NULL OR ${table.numericCode} ~ '^[0-9]{3}$'`,
    ),
    check('countries_name_check', sql`length(trim(${table.name})) >= 2`),
    index('countries_active_name_idx').on(table.isActive, table.name),
  ],
);

export const states = pgTable(
  'states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    countryId: uuid('country_id')
      .notNull()
      .references(() => countries.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 8 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('states_country_code_unique').on(table.countryId, table.code),
    check('states_code_check', sql`${table.code} ~ '^[A-Z0-9-]{1,8}$'`),
    check('states_name_check', sql`length(trim(${table.name})) >= 2`),
    index('states_country_active_name_idx').on(table.countryId, table.isActive, table.name),
  ],
);

export const cities = pgTable(
  'cities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stateId: uuid('state_id')
      .notNull()
      .references(() => states.id, { onDelete: 'restrict' }),
    ibgeCode: varchar('ibge_code', { length: 10 }),
    name: varchar('name', { length: 160 }).notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 10, scale: 6 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('cities_ibge_code_unique')
      .on(table.ibgeCode)
      .where(sql`${table.ibgeCode} IS NOT NULL`),
    check('cities_ibge_code_check', sql`${table.ibgeCode} IS NULL OR ${table.ibgeCode} ~ '^[0-9]{1,10}$'`),
    check('cities_name_check', sql`length(trim(${table.name})) >= 2`),
    check(
      'cities_latitude_check',
      sql`${table.latitude} IS NULL OR (${table.latitude} >= -90 AND ${table.latitude} <= 90)`,
    ),
    check(
      'cities_longitude_check',
      sql`${table.longitude} IS NULL OR (${table.longitude} >= -180 AND ${table.longitude} <= 180)`,
    ),
    check(
      'cities_coordinates_pair_check',
      sql`(${table.latitude} IS NULL AND ${table.longitude} IS NULL) OR (${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL)`,
    ),
    index('cities_state_active_name_idx').on(table.stateId, table.isActive, table.name),
  ],
);

export const unitsOfMeasure = pgTable(
  'units_of_measure',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 16 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    dimension: varchar('dimension', { length: 32 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('units_of_measure_code_unique').on(table.code),
    check('units_of_measure_code_check', sql`length(trim(${table.code})) > 0`),
    check('units_of_measure_name_check', sql`length(trim(${table.name})) > 0`),
    check(
      'units_of_measure_dimension_check',
      sql`${table.dimension} in ('mass','volume','length','count','time','other')`,
    ),
    index('units_of_measure_dimension_active_idx').on(table.dimension, table.isActive),
  ],
);

export const vehicleTypes = pgTable(
  'vehicle_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: varchar('description', { length: 300 }),
    defaultMaxWeightKg: numeric('default_max_weight_kg', { precision: 14, scale: 3 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('vehicle_types_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('vehicle_types_tenant_code_unique').on(table.tenantId, table.code),
    check('vehicle_types_code_check', sql`length(trim(${table.code})) > 0`),
    check('vehicle_types_name_check', sql`length(trim(${table.name})) > 0`),
    check(
      'vehicle_types_weight_check',
      sql`${table.defaultMaxWeightKg} IS NULL OR ${table.defaultMaxWeightKg} > 0`,
    ),
    index('vehicle_types_tenant_active_name_idx').on(table.tenantId, table.isActive, table.name),
    pgPolicy('vehicle_types_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const bodyTypes = pgTable(
  'body_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: varchar('description', { length: 300 }),
    isClosed: boolean('is_closed').default(false).notNull(),
    supportsSideLoading: boolean('supports_side_loading').default(false).notNull(),
    supportsRearLoading: boolean('supports_rear_loading').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('body_types_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('body_types_tenant_code_unique').on(table.tenantId, table.code),
    check('body_types_code_check', sql`length(trim(${table.code})) > 0`),
    check('body_types_name_check', sql`length(trim(${table.name})) > 0`),
    index('body_types_tenant_active_name_idx').on(table.tenantId, table.isActive, table.name),
    pgPolicy('body_types_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const cargoTypes = pgTable(
  'cargo_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: varchar('description', { length: 300 }),
    requiresSpecialHandling: boolean('requires_special_handling').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('cargo_types_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('cargo_types_tenant_code_unique').on(table.tenantId, table.code),
    check('cargo_types_code_check', sql`length(trim(${table.code})) > 0`),
    check('cargo_types_name_check', sql`length(trim(${table.name})) > 0`),
    index('cargo_types_tenant_active_name_idx').on(table.tenantId, table.isActive, table.name),
    pgPolicy('cargo_types_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const packageTypes = pgTable(
  'package_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: varchar('description', { length: 300 }),
    stackableDefault: boolean('stackable_default'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('package_types_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('package_types_tenant_code_unique').on(table.tenantId, table.code),
    check('package_types_code_check', sql`length(trim(${table.code})) > 0`),
    check('package_types_name_check', sql`length(trim(${table.name})) > 0`),
    index('package_types_tenant_active_name_idx').on(table.tenantId, table.isActive, table.name),
    pgPolicy('package_types_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const documentTypes = pgTable(
  'document_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    subjectScope: varchar('subject_scope', { length: 32 }).notNull(),
    hasExpiry: boolean('has_expiry').default(false).notNull(),
    requiresValidation: boolean('requires_validation').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('document_types_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('document_types_tenant_code_unique').on(table.tenantId, table.code),
    check('document_types_code_check', sql`length(trim(${table.code})) > 0`),
    check('document_types_name_check', sql`length(trim(${table.name})) > 0`),
    check(
      'document_types_subject_scope_check',
      sql`${table.subjectScope} in ('party','driver','asset','request','trip','financial','other')`,
    ),
    index('document_types_tenant_scope_active_idx').on(
      table.tenantId,
      table.subjectScope,
      table.isActive,
    ),
    pgPolicy('document_types_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: varchar('description', { length: 300 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('tags_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('tags_tenant_code_unique').on(table.tenantId, table.code),
    check('tags_code_check', sql`length(trim(${table.code})) > 0`),
    check('tags_name_check', sql`length(trim(${table.name})) > 0`),
    index('tags_tenant_active_name_idx').on(table.tenantId, table.isActive, table.name),
    pgPolicy('tags_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
