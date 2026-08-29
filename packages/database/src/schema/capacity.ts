import { sql } from 'drizzle-orm';
import {
  check,
  date,
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

import { users } from './identity.js';
import { businessParties } from './master-data.js';
import { tenantMatchesSession } from './rls.js';

export const driverRegistrationStatusEnum = pgEnum('driver_registration_status', [
  'pending',
  'qualified',
  'blocked',
  'inactive',
]);

export const driverOperationalStatusEnum = pgEnum('driver_operational_status', [
  'active',
  'blocked',
  'inactive',
]);

export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    carrierPartyId: uuid('carrier_party_id'),
    fullName: varchar('full_name', { length: 180 }).notNull(),
    taxId: varchar('tax_id', { length: 11 }).notNull(),
    email: varchar('email', { length: 254 }),
    phone: varchar('phone', { length: 32 }).notNull(),
    whatsapp: varchar('whatsapp', { length: 32 }),
    cnhNumber: varchar('cnh_number', { length: 11 }).notNull(),
    cnhCategory: varchar('cnh_category', { length: 4 }).notNull(),
    cnhExpiresOn: date('cnh_expires_on').notNull(),
    registrationStatus: driverRegistrationStatusEnum('registration_status')
      .default('pending')
      .notNull(),
    operationalStatus: driverOperationalStatusEnum('operational_status')
      .default('inactive')
      .notNull(),
    statusReason: varchar('status_reason', { length: 500 }),
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
    unique('drivers_tenant_tax_id_unique').on(table.tenantId, table.taxId),
    unique('drivers_tenant_cnh_unique').on(table.tenantId, table.cnhNumber),
    unique('drivers_tenant_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.carrierPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'drivers_carrier_party_fk',
    }).onDelete('restrict'),
    check('drivers_tax_id_check', sql`${table.taxId} ~ '^[0-9]{11}$'`),
    check('drivers_cnh_number_check', sql`${table.cnhNumber} ~ '^[0-9]{11}$'`),
    check('drivers_cnh_category_check', sql`${table.cnhCategory} ~ '^(A|B|C|D|E|AB|AC|AD|AE)$'`),
    check('drivers_name_check', sql`length(trim(${table.fullName})) >= 3`),
    check('drivers_phone_check', sql`length(trim(${table.phone})) >= 8`),
    check(
      'drivers_active_status_check',
      sql`${table.operationalStatus} <> 'active' OR ${table.registrationStatus} = 'qualified'`,
    ),
    check(
      'drivers_status_reason_check',
      sql`(${table.registrationStatus} NOT IN ('blocked','inactive') AND ${table.operationalStatus} <> 'blocked') OR ${table.statusReason} IS NOT NULL`,
    ),
    index('drivers_tenant_registration_status_idx').on(table.tenantId, table.registrationStatus),
    index('drivers_tenant_operational_status_idx').on(table.tenantId, table.operationalStatus),
    index('drivers_tenant_carrier_idx').on(table.tenantId, table.carrierPartyId),
    pgPolicy('drivers_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const driverAudit = pgTable(
  'driver_audit',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    driverId: uuid('driver_id').notNull(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    changeType: varchar('change_type', { length: 32 }).notNull(),
    beforeSnapshot: jsonb('before_snapshot'),
    afterSnapshot: jsonb('after_snapshot').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'driver_audit_driver_fk',
    }).onDelete('cascade'),
    check(
      'driver_audit_change_type_check',
      sql`${table.changeType} in ('created','updated','status_changed')`,
    ),
    index('driver_audit_tenant_driver_idx').on(table.tenantId, table.driverId, table.createdAt),
    pgPolicy('driver_audit_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
