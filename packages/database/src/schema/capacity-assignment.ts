import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { capacityAssets, drivers } from './capacity.js';
import { users } from './identity.js';
import { businessParties } from './master-data.js';
import { tenantMatchesSession } from './rls.js';

export const capacityAssignmentStatusEnum = pgEnum('capacity_assignment_status', [
  'active',
  'ended',
  'cancelled',
]);

export const capacityAssignments = pgTable(
  'capacity_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    driverId: uuid('driver_id').notNull(),
    vehicleId: uuid('vehicle_id').notNull(),
    carrierPartyId: uuid('carrier_party_id').notNull(),
    status: capacityAssignmentStatusEnum('status').default('active').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).defaultNow().notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
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
    unique('capacity_assignments_tenant_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'capacity_assignments_driver_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.vehicleId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_assignments_vehicle_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.carrierPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'capacity_assignments_carrier_party_fk',
    }).onDelete('restrict'),
    check(
      'capacity_assignments_period_check',
      sql`${table.endsAt} IS NULL OR ${table.endsAt} >= ${table.startsAt}`,
    ),
    check(
      'capacity_assignments_active_period_check',
      sql`(${table.status} = 'active' AND ${table.endsAt} IS NULL) OR (${table.status} IN ('ended','cancelled') AND ${table.endsAt} IS NOT NULL)`,
    ),
    check(
      'capacity_assignments_cancel_reason_check',
      sql`${table.status} <> 'cancelled' OR ${table.statusReason} IS NOT NULL`,
    ),
    uniqueIndex('capacity_assignments_active_driver_unique')
      .on(table.tenantId, table.driverId)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex('capacity_assignments_active_vehicle_unique')
      .on(table.tenantId, table.vehicleId)
      .where(sql`${table.status} = 'active'`),
    index('capacity_assignments_tenant_carrier_status_idx').on(
      table.tenantId,
      table.carrierPartyId,
      table.status,
    ),
    index('capacity_assignments_tenant_driver_history_idx').on(
      table.tenantId,
      table.driverId,
      table.startsAt,
    ),
    index('capacity_assignments_tenant_vehicle_history_idx').on(
      table.tenantId,
      table.vehicleId,
      table.startsAt,
    ),
    pgPolicy('capacity_assignments_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
