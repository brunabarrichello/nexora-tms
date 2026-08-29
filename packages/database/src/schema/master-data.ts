import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './platform.js';
import { tenantMatchesSession } from './rls.js';

export const businessPartyStatusEnum = pgEnum('business_party_status', ['active', 'inactive']);

export const businessParties = pgTable(
  'business_parties',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    taxId: varchar('tax_id', { length: 20 }).notNull(),
    legalName: varchar('legal_name', { length: 200 }).notNull(),
    tradeName: varchar('trade_name', { length: 200 }),
    email: varchar('email', { length: 254 }),
    phone: varchar('phone', { length: 32 }),
    status: businessPartyStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('business_parties_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('business_parties_tenant_tax_id_unique').on(table.tenantId, table.taxId),
    index('business_parties_tenant_status_idx').on(table.tenantId, table.status),
    pgPolicy('business_parties_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const businessPartyRoles = pgTable(
  'business_party_roles',
  {
    tenantId: uuid('tenant_id').notNull(),
    partyId: uuid('party_id').notNull(),
    role: varchar('role', { length: 32 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.partyId, table.role],
      name: 'business_party_roles_pk',
    }),
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'business_party_roles_party_fk',
    }).onDelete('cascade'),
    check(
      'business_party_roles_role_check',
      sql`${table.role} in ('customer', 'shipper', 'consignee', 'carrier', 'partner', 'supplier')`,
    ),
    index('business_party_roles_tenant_role_idx').on(table.tenantId, table.role),
    pgPolicy('business_party_roles_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export interface BusinessPartyAuditSnapshot {
  readonly id: string;
  readonly taxId: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly status: 'active' | 'inactive';
  readonly roles: readonly string[];
}

export const businessPartyAudit = pgTable(
  'business_party_audit',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    partyId: uuid('party_id').notNull(),
    actorUserId: uuid('actor_user_id').notNull(),
    changeType: varchar('change_type', { length: 32 }).notNull(),
    beforeSnapshot: jsonb('before_snapshot').$type<BusinessPartyAuditSnapshot | null>(),
    afterSnapshot: jsonb('after_snapshot').$type<BusinessPartyAuditSnapshot>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'business_party_audit_party_fk',
    }).onDelete('restrict'),
    check(
      'business_party_audit_change_type_check',
      sql`${table.changeType} in ('created', 'updated')`,
    ),
    index('business_party_audit_party_created_idx').on(
      table.tenantId,
      table.partyId,
      table.createdAt,
    ),
    pgPolicy('business_party_audit_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
