import { sql } from 'drizzle-orm';
import {
  bigint,
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
  primaryKey,
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
import { businessPartyAddresses } from './master-data-directory.js';
import { businessParties } from './master-data.js';
import { businessUnits, organizations, tenants } from './platform.js';
import { cargoTypes, cities, documentTypes, states, tags } from './reference-data.js';
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

export const departments = pgTable(
  'departments',
  {
    ...tenantMutableColumns(),
    organizationId: uuid('organization_id').notNull(),
    businessUnitId: uuid('business_unit_id'),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    unique('departments_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('departments_tenant_org_code_unique').on(
      table.tenantId,
      table.organizationId,
      table.code,
    ),
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
      name: 'departments_organization_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.organizationId, table.businessUnitId],
      foreignColumns: [businessUnits.tenantId, businessUnits.organizationId, businessUnits.id],
      name: 'departments_business_unit_fk',
    }).onDelete('restrict'),
    check('departments_code_check', sql`length(trim(${table.code})) > 0`),
    check('departments_name_check', sql`length(trim(${table.name})) > 0`),
    index('departments_tenant_unit_active_idx').on(
      table.tenantId,
      table.businessUnitId,
      table.isActive,
    ),
    pgPolicy('departments_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const costCenters = pgTable(
  'cost_centers',
  {
    ...tenantMutableColumns(),
    organizationId: uuid('organization_id').notNull(),
    businessUnitId: uuid('business_unit_id'),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    unique('cost_centers_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('cost_centers_tenant_org_code_unique').on(
      table.tenantId,
      table.organizationId,
      table.code,
    ),
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
      name: 'cost_centers_organization_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.organizationId, table.businessUnitId],
      foreignColumns: [businessUnits.tenantId, businessUnits.organizationId, businessUnits.id],
      name: 'cost_centers_business_unit_fk',
    }).onDelete('restrict'),
    check('cost_centers_code_check', sql`length(trim(${table.code})) > 0`),
    check('cost_centers_name_check', sql`length(trim(${table.name})) > 0`),
    index('cost_centers_tenant_unit_active_idx').on(
      table.tenantId,
      table.businessUnitId,
      table.isActive,
    ),
    pgPolicy('cost_centers_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const numberSequences = pgTable(
  'number_sequences',
  {
    ...tenantMutableColumns(),
    scope: varchar('scope', { length: 64 }).notNull(),
    prefix: varchar('prefix', { length: 32 }),
    nextValue: bigint('next_value', { mode: 'number' }).default(1).notNull(),
    padding: integer('padding').default(0).notNull(),
  },
  (table) => [
    unique('number_sequences_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('number_sequences_tenant_scope_unique').on(table.tenantId, table.scope),
    check('number_sequences_scope_check', sql`length(trim(${table.scope})) > 0`),
    check('number_sequences_next_value_check', sql`${table.nextValue} > 0`),
    check('number_sequences_padding_check', sql`${table.padding} >= 0 AND ${table.padding} <= 20`),
    pgPolicy('number_sequences_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const moduleSettings = pgTable(
  'module_settings',
  {
    ...tenantMutableColumns(),
    module: varchar('module', { length: 64 }).notNull(),
    settings: jsonb('settings')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
  },
  (table) => [
    unique('module_settings_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('module_settings_tenant_module_unique').on(table.tenantId, table.module),
    check('module_settings_module_check', sql`length(trim(${table.module})) > 0`),
    pgPolicy('module_settings_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const featureFlags = pgTable(
  'feature_flags',
  {
    ...tenantMutableColumns(),
    key: varchar('key', { length: 120 }).notNull(),
    enabled: boolean('enabled').default(false).notNull(),
    configuration: jsonb('configuration')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
  },
  (table) => [
    unique('feature_flags_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('feature_flags_tenant_key_unique').on(table.tenantId, table.key),
    check('feature_flags_key_check', sql`length(trim(${table.key})) > 0`),
    index('feature_flags_tenant_enabled_idx').on(table.tenantId, table.enabled),
    pgPolicy('feature_flags_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const locations = pgTable(
  'locations',
  {
    ...tenantMutableColumns(),
    partyId: uuid('party_id'),
    addressId: uuid('address_id'),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    cityId: uuid('city_id').references(() => cities.id, { onDelete: 'restrict' }),
    postalCode: varchar('postal_code', { length: 16 }),
    street: varchar('street', { length: 200 }),
    number: varchar('number', { length: 40 }),
    complement: varchar('complement', { length: 160 }),
    district: varchar('district', { length: 120 }),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 10, scale: 6 }),
    operationalReference: varchar('operational_reference', { length: 500 }),
    isActive: boolean('is_active').default(true).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedByUserId: uuid('deleted_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    unique('locations_tenant_id_id_unique').on(table.tenantId, table.id),
    uniqueIndex('locations_tenant_code_live_unique')
      .on(table.tenantId, table.code)
      .where(sql`${table.deletedAt} IS NULL`),
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'locations_party_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.partyId, table.addressId],
      foreignColumns: [
        businessPartyAddresses.tenantId,
        businessPartyAddresses.partyId,
        businessPartyAddresses.id,
      ],
      name: 'locations_party_address_fk',
    }).onDelete('restrict'),
    check('locations_code_check', sql`length(trim(${table.code})) > 0`),
    check('locations_name_check', sql`length(trim(${table.name})) > 0`),
    check(
      'locations_type_check',
      sql`${table.type} in ('customer','shipper','consignee','terminal','warehouse','yard','port','airport','border','support','other')`,
    ),
    check(
      'locations_party_address_pair_check',
      sql`(${table.partyId} IS NULL AND ${table.addressId} IS NULL) OR (${table.partyId} IS NOT NULL AND ${table.addressId} IS NOT NULL)`,
    ),
    check(
      'locations_standalone_address_check',
      sql`${table.addressId} IS NOT NULL OR (${table.cityId} IS NOT NULL AND length(trim(coalesce(${table.street}, ''))) >= 2)`,
    ),
    check(
      'locations_latitude_check',
      sql`${table.latitude} IS NULL OR (${table.latitude} >= -90 AND ${table.latitude} <= 90)`,
    ),
    check(
      'locations_longitude_check',
      sql`${table.longitude} IS NULL OR (${table.longitude} >= -180 AND ${table.longitude} <= 180)`,
    ),
    check(
      'locations_coordinates_pair_check',
      sql`(${table.latitude} IS NULL AND ${table.longitude} IS NULL) OR (${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL)`,
    ),
    check(
      'locations_soft_delete_check',
      sql`(${table.deletedAt} IS NULL AND ${table.deletedByUserId} IS NULL) OR (${table.deletedAt} IS NOT NULL AND ${table.deletedByUserId} IS NOT NULL)`,
    ),
    index('locations_tenant_city_active_idx').on(table.tenantId, table.cityId, table.isActive),
    index('locations_tenant_party_active_idx').on(table.tenantId, table.partyId, table.isActive),
    pgPolicy('locations_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const businessPartyGroups = pgTable(
  'business_party_groups',
  {
    ...tenantMutableColumns(),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    groupType: varchar('group_type', { length: 32 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    unique('business_party_groups_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('business_party_groups_tenant_code_unique').on(table.tenantId, table.code),
    check(
      'business_party_groups_type_check',
      sql`${table.groupType} in ('economic','commercial','operational','risk','other')`,
    ),
    index('business_party_groups_tenant_type_active_idx').on(
      table.tenantId,
      table.groupType,
      table.isActive,
    ),
    pgPolicy('business_party_groups_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const businessPartyGroupMembers = pgTable(
  'business_party_group_members',
  {
    tenantId: uuid('tenant_id').notNull(),
    groupId: uuid('group_id').notNull(),
    partyId: uuid('party_id').notNull(),
    startsOn: date('starts_on'),
    endsOn: date('ends_on'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.groupId, table.partyId],
      name: 'business_party_group_members_pk',
    }),
    foreignKey({
      columns: [table.tenantId, table.groupId],
      foreignColumns: [businessPartyGroups.tenantId, businessPartyGroups.id],
      name: 'business_party_group_members_group_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'business_party_group_members_party_fk',
    }).onDelete('restrict'),
    check(
      'business_party_group_members_period_check',
      sql`${table.endsOn} IS NULL OR ${table.startsOn} IS NULL OR ${table.endsOn} >= ${table.startsOn}`,
    ),
    index('business_party_group_members_tenant_party_idx').on(table.tenantId, table.partyId),
    pgPolicy('business_party_group_members_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const businessPartyRequirements = pgTable(
  'business_party_requirements',
  {
    ...tenantMutableColumns(),
    partyId: uuid('party_id').notNull(),
    requirementType: varchar('requirement_type', { length: 64 }).notNull(),
    valueText: varchar('value_text', { length: 1000 }),
    valueJson: jsonb('value_json').$type<unknown>(),
    isMandatory: boolean('is_mandatory').default(true).notNull(),
    validFrom: date('valid_from'),
    validUntil: date('valid_until'),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    unique('business_party_requirements_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'business_party_requirements_party_fk',
    }).onDelete('restrict'),
    check(
      'business_party_requirements_type_check',
      sql`length(trim(${table.requirementType})) > 0`,
    ),
    check(
      'business_party_requirements_value_check',
      sql`num_nonnulls(${table.valueText}, ${table.valueJson}) <= 1 AND (NOT ${table.isMandatory} OR num_nonnulls(${table.valueText}, ${table.valueJson}) = 1)`,
    ),
    check(
      'business_party_requirements_period_check',
      sql`${table.validUntil} IS NULL OR ${table.validFrom} IS NULL OR ${table.validUntil} >= ${table.validFrom}`,
    ),
    index('business_party_requirements_tenant_party_type_idx').on(
      table.tenantId,
      table.partyId,
      table.requirementType,
      table.isActive,
    ),
    pgPolicy('business_party_requirements_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const businessPartyDocumentRequirements = pgTable(
  'business_party_document_requirements',
  {
    ...tenantMutableColumns(),
    partyId: uuid('party_id').notNull(),
    documentTypeId: uuid('document_type_id').notNull(),
    subjectScope: varchar('subject_scope', { length: 32 }).notNull(),
    isMandatory: boolean('is_mandatory').default(true).notNull(),
    leadDays: integer('lead_days').default(30).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    unique('business_party_document_requirements_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('business_party_document_requirements_unique').on(
      table.tenantId,
      table.partyId,
      table.documentTypeId,
      table.subjectScope,
    ),
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'business_party_document_requirements_party_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.documentTypeId],
      foreignColumns: [documentTypes.tenantId, documentTypes.id],
      name: 'business_party_document_requirements_document_type_fk',
    }).onDelete('restrict'),
    check(
      'business_party_document_requirements_scope_check',
      sql`length(trim(${table.subjectScope})) > 0`,
    ),
    check('business_party_document_requirements_lead_days_check', sql`${table.leadDays} >= 0`),
    index('business_party_document_requirements_tenant_party_idx').on(
      table.tenantId,
      table.partyId,
      table.isActive,
    ),
    pgPolicy('business_party_document_requirements_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const businessPartyServiceAreas = pgTable(
  'business_party_service_areas',
  {
    ...tenantMutableColumns(),
    partyId: uuid('party_id').notNull(),
    stateId: uuid('state_id').references(() => states.id, { onDelete: 'restrict' }),
    cityId: uuid('city_id').references(() => cities.id, { onDelete: 'restrict' }),
    radiusKm: numeric('radius_km', { precision: 10, scale: 2 }),
    direction: varchar('direction', { length: 16 }).default('both').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    unique('business_party_service_areas_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'business_party_service_areas_party_fk',
    }).onDelete('restrict'),
    check(
      'business_party_service_areas_geo_check',
      sql`num_nonnulls(${table.stateId}, ${table.cityId}) = 1`,
    ),
    check(
      'business_party_service_areas_radius_check',
      sql`${table.radiusKm} IS NULL OR ${table.radiusKm} > 0`,
    ),
    check(
      'business_party_service_areas_direction_check',
      sql`${table.direction} in ('inbound','outbound','both')`,
    ),
    index('business_party_service_areas_tenant_party_idx').on(
      table.tenantId,
      table.partyId,
      table.isActive,
    ),
    index('business_party_service_areas_geo_idx').on(table.tenantId, table.stateId, table.cityId),
    pgPolicy('business_party_service_areas_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const businessPartyBillingRules = pgTable(
  'business_party_billing_rules',
  {
    ...tenantMutableColumns(),
    partyId: uuid('party_id').notNull(),
    ruleType: varchar('rule_type', { length: 64 }).notNull(),
    configuration: jsonb('configuration').$type<Record<string, unknown>>().notNull(),
    validFrom: date('valid_from').notNull(),
    validUntil: date('valid_until'),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    unique('business_party_billing_rules_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'business_party_billing_rules_party_fk',
    }).onDelete('restrict'),
    check('business_party_billing_rules_type_check', sql`length(trim(${table.ruleType})) > 0`),
    check(
      'business_party_billing_rules_period_check',
      sql`${table.validUntil} IS NULL OR ${table.validUntil} >= ${table.validFrom}`,
    ),
    index('business_party_billing_rules_tenant_party_type_idx').on(
      table.tenantId,
      table.partyId,
      table.ruleType,
      table.isActive,
    ),
    pgPolicy('business_party_billing_rules_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const businessPartyCreditLimits = pgTable(
  'business_party_credit_limits',
  {
    ...tenantMutableColumns(),
    partyId: uuid('party_id').notNull(),
    currencyId: uuid('currency_id')
      .notNull()
      .references(() => currencies.id, { onDelete: 'restrict' }),
    limitAmount: numeric('limit_amount', { precision: 18, scale: 2 }).notNull(),
    validFrom: date('valid_from').notNull(),
    validUntil: date('valid_until'),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    unique('business_party_credit_limits_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'business_party_credit_limits_party_fk',
    }).onDelete('restrict'),
    check('business_party_credit_limits_amount_check', sql`${table.limitAmount} >= 0`),
    check(
      'business_party_credit_limits_period_check',
      sql`${table.validUntil} IS NULL OR ${table.validUntil} >= ${table.validFrom}`,
    ),
    index('business_party_credit_limits_tenant_party_currency_idx').on(
      table.tenantId,
      table.partyId,
      table.currencyId,
      table.isActive,
    ),
    pgPolicy('business_party_credit_limits_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const commodities = pgTable(
  'commodities',
  {
    ...tenantMutableColumns(),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: varchar('description', { length: 500 }),
    defaultCargoTypeId: uuid('default_cargo_type_id'),
    isHazardous: boolean('is_hazardous').default(false).notNull(),
    requiresTemperatureControl: boolean('requires_temperature_control').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    unique('commodities_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('commodities_tenant_code_unique').on(table.tenantId, table.code),
    foreignKey({
      columns: [table.tenantId, table.defaultCargoTypeId],
      foreignColumns: [cargoTypes.tenantId, cargoTypes.id],
      name: 'commodities_default_cargo_type_fk',
    }).onDelete('restrict'),
    check('commodities_code_check', sql`length(trim(${table.code})) > 0`),
    check('commodities_name_check', sql`length(trim(${table.name})) > 0`),
    index('commodities_tenant_active_name_idx').on(table.tenantId, table.isActive, table.name),
    pgPolicy('commodities_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const businessPartyTags = pgTable(
  'business_party_tags',
  {
    tenantId: uuid('tenant_id').notNull(),
    partyId: uuid('party_id').notNull(),
    tagId: uuid('tag_id').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.partyId, table.tagId],
      name: 'business_party_tags_pk',
    }),
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'business_party_tags_party_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tagId],
      foreignColumns: [tags.tenantId, tags.id],
      name: 'business_party_tags_tag_fk',
    }).onDelete('restrict'),
    index('business_party_tags_tenant_tag_idx').on(table.tenantId, table.tagId),
    pgPolicy('business_party_tags_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const driverTags = pgTable(
  'driver_tags',
  {
    tenantId: uuid('tenant_id').notNull(),
    driverId: uuid('driver_id').notNull(),
    tagId: uuid('tag_id').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.driverId, table.tagId], name: 'driver_tags_pk' }),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'driver_tags_driver_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tagId],
      foreignColumns: [tags.tenantId, tags.id],
      name: 'driver_tags_tag_fk',
    }).onDelete('restrict'),
    index('driver_tags_tenant_tag_idx').on(table.tenantId, table.tagId),
    pgPolicy('driver_tags_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityAssetTags = pgTable(
  'capacity_asset_tags',
  {
    tenantId: uuid('tenant_id').notNull(),
    assetId: uuid('asset_id').notNull(),
    tagId: uuid('tag_id').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.assetId, table.tagId],
      name: 'capacity_asset_tags_pk',
    }),
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_asset_tags_asset_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tagId],
      foreignColumns: [tags.tenantId, tags.id],
      name: 'capacity_asset_tags_tag_fk',
    }).onDelete('restrict'),
    index('capacity_asset_tags_tenant_tag_idx').on(table.tenantId, table.tagId),
    pgPolicy('capacity_asset_tags_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const transportRequestTags = pgTable(
  'transport_request_tags',
  {
    tenantId: uuid('tenant_id').notNull(),
    transportRequestId: uuid('transport_request_id').notNull(),
    tagId: uuid('tag_id').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.transportRequestId, table.tagId],
      name: 'transport_request_tags_pk',
    }),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'transport_request_tags_request_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.tagId],
      foreignColumns: [tags.tenantId, tags.id],
      name: 'transport_request_tags_tag_fk',
    }).onDelete('restrict'),
    index('transport_request_tags_tenant_tag_idx').on(table.tenantId, table.tagId),
    pgPolicy('transport_request_tags_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const customFieldDefinitions = pgTable(
  'custom_field_definitions',
  {
    ...tenantMutableColumns(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    key: varchar('key', { length: 120 }).notNull(),
    label: varchar('label', { length: 160 }).notNull(),
    dataType: varchar('data_type', { length: 32 }).notNull(),
    isRequired: boolean('is_required').default(false).notNull(),
    validation: jsonb('validation').$type<Record<string, unknown>>(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    unique('custom_field_definitions_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('custom_field_definitions_tenant_entity_key_unique').on(
      table.tenantId,
      table.entityType,
      table.key,
    ),
    check('custom_field_definitions_entity_type_check', sql`length(trim(${table.entityType})) > 0`),
    check('custom_field_definitions_key_check', sql`length(trim(${table.key})) > 0`),
    check('custom_field_definitions_label_check', sql`length(trim(${table.label})) > 0`),
    check(
      'custom_field_definitions_data_type_check',
      sql`${table.dataType} in ('string','number','boolean','date','datetime','json')`,
    ),
    index('custom_field_definitions_tenant_entity_active_idx').on(
      table.tenantId,
      table.entityType,
      table.isActive,
    ),
    pgPolicy('custom_field_definitions_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const customFieldValues = pgTable(
  'custom_field_values',
  {
    ...tenantMutableColumns(),
    definitionId: uuid('definition_id').notNull(),
    subjectId: uuid('subject_id').notNull(),
    valueJson: jsonb('value_json').$type<unknown>().notNull(),
  },
  (table) => [
    unique('custom_field_values_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('custom_field_values_tenant_definition_subject_unique').on(
      table.tenantId,
      table.definitionId,
      table.subjectId,
    ),
    foreignKey({
      columns: [table.tenantId, table.definitionId],
      foreignColumns: [customFieldDefinitions.tenantId, customFieldDefinitions.id],
      name: 'custom_field_values_definition_fk',
    }).onDelete('restrict'),
    index('custom_field_values_tenant_subject_idx').on(table.tenantId, table.subjectId),
    pgPolicy('custom_field_values_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
