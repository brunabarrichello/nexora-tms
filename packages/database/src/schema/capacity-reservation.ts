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

import { capacityAssignments } from './capacity-assignment.js';
import { capacityAssets, drivers } from './capacity.js';
import { transportRequests } from './freight.js';
import { users } from './identity.js';
import { businessParties } from './master-data.js';
import { freightProposals } from './negotiation.js';
import { tenantMatchesSession } from './rls.js';

export const capacityReservationStatusEnum = pgEnum('capacity_reservation_status', [
  'active',
  'cancelled',
  'released',
]);

export const capacityReservationEventTypeEnum = pgEnum('capacity_reservation_event_type', [
  'approved',
  'cancelled',
  'released',
]);

export const capacityReservations = pgTable(
  'capacity_reservations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    transportRequestId: uuid('transport_request_id').notNull(),
    proposalId: uuid('proposal_id').notNull(),
    capacityAssignmentId: uuid('capacity_assignment_id').notNull(),
    driverId: uuid('driver_id').notNull(),
    vehicleId: uuid('vehicle_id').notNull(),
    carrierPartyId: uuid('carrier_party_id').notNull(),
    status: capacityReservationStatusEnum('status').default('active').notNull(),
    approvedByUserId: uuid('approved_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }).defaultNow().notNull(),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: varchar('cancel_reason', { length: 1000 }),
    releasedByUserId: uuid('released_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releaseReason: varchar('release_reason', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('capacity_reservations_tenant_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'capacity_reservations_request_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.proposalId],
      foreignColumns: [freightProposals.tenantId, freightProposals.id],
      name: 'capacity_reservations_proposal_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.capacityAssignmentId],
      foreignColumns: [capacityAssignments.tenantId, capacityAssignments.id],
      name: 'capacity_reservations_assignment_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'capacity_reservations_driver_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.vehicleId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'capacity_reservations_vehicle_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.carrierPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'capacity_reservations_carrier_party_fk',
    }).onDelete('restrict'),
    check(
      'capacity_reservations_state_check',
      sql`(
        ${table.status} = 'active'
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
        AND ${table.releasedByUserId} IS NULL
        AND ${table.releasedAt} IS NULL
        AND ${table.releaseReason} IS NULL
      ) OR (
        ${table.status} = 'cancelled'
        AND ${table.cancelledByUserId} IS NOT NULL
        AND ${table.cancelledAt} IS NOT NULL
        AND length(trim(coalesce(${table.cancelReason}, ''))) > 0
        AND ${table.releasedByUserId} IS NULL
        AND ${table.releasedAt} IS NULL
        AND ${table.releaseReason} IS NULL
      ) OR (
        ${table.status} = 'released'
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
        AND ${table.releasedByUserId} IS NOT NULL
        AND ${table.releasedAt} IS NOT NULL
        AND length(trim(coalesce(${table.releaseReason}, ''))) > 0
      )`,
    ),
    uniqueIndex('capacity_reservations_active_request_unique')
      .on(table.tenantId, table.transportRequestId)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex('capacity_reservations_active_assignment_unique')
      .on(table.tenantId, table.capacityAssignmentId)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex('capacity_reservations_active_driver_unique')
      .on(table.tenantId, table.driverId)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex('capacity_reservations_active_vehicle_unique')
      .on(table.tenantId, table.vehicleId)
      .where(sql`${table.status} = 'active'`),
    index('capacity_reservations_request_history_idx').on(
      table.tenantId,
      table.transportRequestId,
      table.createdAt,
    ),
    index('capacity_reservations_carrier_status_idx').on(
      table.tenantId,
      table.carrierPartyId,
      table.status,
    ),
    pgPolicy('capacity_reservations_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const capacityReservationEvents = pgTable(
  'capacity_reservation_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    reservationId: uuid('reservation_id').notNull(),
    type: capacityReservationEventTypeEnum('type').notNull(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reason: varchar('reason', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.reservationId],
      foreignColumns: [capacityReservations.tenantId, capacityReservations.id],
      name: 'capacity_reservation_events_reservation_fk',
    }).onDelete('restrict'),
    check(
      'capacity_reservation_events_reason_check',
      sql`${table.type} = 'approved' OR length(trim(coalesce(${table.reason}, ''))) > 0`,
    ),
    index('capacity_reservation_events_reservation_created_idx').on(
      table.tenantId,
      table.reservationId,
      table.createdAt,
    ),
    pgPolicy('capacity_reservation_events_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
