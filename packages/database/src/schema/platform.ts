import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenantMatchesSession } from './rls.js';

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended']);

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: varchar('slug', { length: 80 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    status: tenantStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('tenants_slug_unique').on(table.slug),
    pgPolicy('tenants_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.id),
      withCheck: tenantMatchesSession(table.id),
    }),
  ],
);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('organizations_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('organizations_tenant_code_unique').on(table.tenantId, table.code),
    index('organizations_tenant_idx').on(table.tenantId),
    pgPolicy('organizations_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const businessUnits = pgTable(
  'business_units',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    parentBusinessUnitId: uuid('parent_business_unit_id'),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('business_units_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('business_units_tenant_org_id_id_unique').on(
      table.tenantId,
      table.organizationId,
      table.id,
    ),
    unique('business_units_tenant_org_code_unique').on(
      table.tenantId,
      table.organizationId,
      table.code,
    ),
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
      name: 'business_units_tenant_org_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.organizationId, table.parentBusinessUnitId],
      foreignColumns: [table.tenantId, table.organizationId, table.id],
      name: 'business_units_parent_fk',
    }).onDelete('restrict'),
    index('business_units_tenant_org_idx').on(table.tenantId, table.organizationId),
    pgPolicy('business_units_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const tenantSettings = pgTable(
  'tenant_settings',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    settings: jsonb('settings')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    pgPolicy('tenant_settings_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
