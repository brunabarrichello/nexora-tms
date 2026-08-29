import {
  foreignKey,
  index,
  pgPolicy,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { memberships } from './identity.js';
import { businessUnits, organizations, tenants } from './platform.js';
import { tenantMatchesSession } from './rls.js';

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 160 }).notNull(),
    description: varchar('description', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('permissions_key_unique').on(table.key)],
);

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: varchar('description', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('roles_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('roles_tenant_code_unique').on(table.tenantId, table.code),
    index('roles_tenant_idx').on(table.tenantId),
    pgPolicy('roles_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    tenantId: uuid('tenant_id').notNull(),
    roleId: uuid('role_id').notNull(),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.roleId, table.permissionId],
      name: 'role_permissions_pk',
    }),
    foreignKey({
      columns: [table.tenantId, table.roleId],
      foreignColumns: [roles.tenantId, roles.id],
      name: 'role_permissions_tenant_role_fk',
    }).onDelete('cascade'),
    index('role_permissions_permission_idx').on(table.permissionId),
    pgPolicy('role_permissions_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const membershipRoles = pgTable(
  'membership_roles',
  {
    tenantId: uuid('tenant_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    roleId: uuid('role_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.membershipId, table.roleId],
      name: 'membership_roles_pk',
    }),
    foreignKey({
      columns: [table.tenantId, table.membershipId],
      foreignColumns: [memberships.tenantId, memberships.id],
      name: 'membership_roles_tenant_membership_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.roleId],
      foreignColumns: [roles.tenantId, roles.id],
      name: 'membership_roles_tenant_role_fk',
    }).onDelete('cascade'),
    index('membership_roles_role_idx').on(table.tenantId, table.roleId),
    pgPolicy('membership_roles_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const membershipOrganizationScopes = pgTable(
  'membership_organization_scopes',
  {
    tenantId: uuid('tenant_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.membershipId, table.organizationId],
      name: 'membership_organization_scopes_pk',
    }),
    foreignKey({
      columns: [table.tenantId, table.membershipId],
      foreignColumns: [memberships.tenantId, memberships.id],
      name: 'membership_organization_scopes_membership_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
      name: 'membership_organization_scopes_organization_fk',
    }).onDelete('cascade'),
    index('membership_organization_scopes_org_idx').on(table.tenantId, table.organizationId),
    pgPolicy('membership_organization_scopes_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const membershipBusinessUnitScopes = pgTable(
  'membership_business_unit_scopes',
  {
    tenantId: uuid('tenant_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    businessUnitId: uuid('business_unit_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.membershipId, table.businessUnitId],
      name: 'membership_business_unit_scopes_pk',
    }),
    foreignKey({
      columns: [table.tenantId, table.membershipId],
      foreignColumns: [memberships.tenantId, memberships.id],
      name: 'membership_business_unit_scopes_membership_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.businessUnitId],
      foreignColumns: [businessUnits.tenantId, businessUnits.id],
      name: 'membership_business_unit_scopes_business_unit_fk',
    }).onDelete('cascade'),
    index('membership_business_unit_scopes_unit_idx').on(table.tenantId, table.businessUnitId),
    pgPolicy('membership_business_unit_scopes_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
