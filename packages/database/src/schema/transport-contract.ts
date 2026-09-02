import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  numeric,
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
import { capacityReservations } from './capacity-reservation.js';
import { capacityAssets, drivers } from './capacity.js';
import { transportRequests } from './freight.js';
import { users } from './identity.js';
import { businessParties } from './master-data.js';
import { freightProposals } from './negotiation.js';
import { tenantMatchesSession } from './rls.js';

export const transportContractStatusEnum = pgEnum('transport_contract_status', [
  'confirmed',
  'refused',
  'cancelled',
  'fulfilled',
]);

export const transportContractEventTypeEnum = pgEnum('transport_contract_event_type', [
  'confirmed',
  'refused',
  'cancelled',
  'fulfilled',
]);

export const transportContracts = pgTable(
  'transport_contracts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    transportRequestId: uuid('transport_request_id').notNull(),
    reservationId: uuid('reservation_id').notNull(),
    proposalId: uuid('proposal_id').notNull(),
    capacityAssignmentId: uuid('capacity_assignment_id').notNull(),
    driverId: uuid('driver_id').notNull(),
    vehicleId: uuid('vehicle_id').notNull(),
    carrierPartyId: uuid('carrier_party_id').notNull(),
    status: transportContractStatusEnum('status').notNull(),
    currencyCode: varchar('currency_code', { length: 3 }).notNull(),
    freightAmount: numeric('freight_amount', { precision: 14, scale: 2 }).notNull(),
    tollAmount: numeric('toll_amount', { precision: 14, scale: 2 }).notNull(),
    additionalAmount: numeric('additional_amount', { precision: 14, scale: 2 }).notNull(),
    paymentTerms: varchar('payment_terms', { length: 300 }).notNull(),
    commercialNotes: varchar('commercial_notes', { length: 1000 }),
    confirmedByUserId: uuid('confirmed_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    fulfilledByUserId: uuid('fulfilled_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    refusedByUserId: uuid('refused_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    refusedAt: timestamp('refused_at', { withTimezone: true }),
    refusalReason: varchar('refusal_reason', { length: 1000 }),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: varchar('cancel_reason', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('transport_contracts_tenant_id_unique').on(table.tenantId, table.id),
    unique('transport_contracts_tenant_request_id_unique').on(
      table.tenantId,
      table.transportRequestId,
      table.id,
    ),
    unique('transport_contracts_reservation_unique').on(table.tenantId, table.reservationId),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'transport_contracts_request_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.reservationId],
      foreignColumns: [capacityReservations.tenantId, capacityReservations.id],
      name: 'transport_contracts_reservation_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.proposalId],
      foreignColumns: [freightProposals.tenantId, freightProposals.id],
      name: 'transport_contracts_proposal_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.capacityAssignmentId],
      foreignColumns: [capacityAssignments.tenantId, capacityAssignments.id],
      name: 'transport_contracts_assignment_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'transport_contracts_driver_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.vehicleId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'transport_contracts_vehicle_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.carrierPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'transport_contracts_carrier_party_fk',
    }).onDelete('restrict'),
    check('transport_contracts_currency_check', sql`${table.currencyCode} ~ '^[A-Z]{3}$'`),
    check('transport_contracts_freight_amount_check', sql`${table.freightAmount} > 0`),
    check('transport_contracts_toll_amount_check', sql`${table.tollAmount} >= 0`),
    check('transport_contracts_additional_amount_check', sql`${table.additionalAmount} >= 0`),
    check('transport_contracts_payment_terms_check', sql`length(trim(${table.paymentTerms})) > 0`),
    check(
      'transport_contracts_state_check',
      sql`(
        ${table.status} = 'confirmed'
        AND ${table.confirmedByUserId} IS NOT NULL
        AND ${table.confirmedAt} IS NOT NULL
        AND ${table.fulfilledByUserId} IS NULL
        AND ${table.fulfilledAt} IS NULL
        AND ${table.refusedByUserId} IS NULL
        AND ${table.refusedAt} IS NULL
        AND ${table.refusalReason} IS NULL
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
      ) OR (
        ${table.status} = 'fulfilled'
        AND ${table.confirmedByUserId} IS NOT NULL
        AND ${table.confirmedAt} IS NOT NULL
        AND ${table.fulfilledByUserId} IS NOT NULL
        AND ${table.fulfilledAt} IS NOT NULL
        AND ${table.refusedByUserId} IS NULL
        AND ${table.refusedAt} IS NULL
        AND ${table.refusalReason} IS NULL
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
      ) OR (
        ${table.status} = 'refused'
        AND ${table.confirmedByUserId} IS NULL
        AND ${table.confirmedAt} IS NULL
        AND ${table.fulfilledByUserId} IS NULL
        AND ${table.fulfilledAt} IS NULL
        AND ${table.refusedByUserId} IS NOT NULL
        AND ${table.refusedAt} IS NOT NULL
        AND length(trim(coalesce(${table.refusalReason}, ''))) > 0
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
      ) OR (
        ${table.status} = 'cancelled'
        AND ${table.confirmedByUserId} IS NOT NULL
        AND ${table.confirmedAt} IS NOT NULL
        AND ${table.fulfilledByUserId} IS NULL
        AND ${table.fulfilledAt} IS NULL
        AND ${table.refusedByUserId} IS NULL
        AND ${table.refusedAt} IS NULL
        AND ${table.refusalReason} IS NULL
        AND ${table.cancelledByUserId} IS NOT NULL
        AND ${table.cancelledAt} IS NOT NULL
        AND length(trim(coalesce(${table.cancelReason}, ''))) > 0
      )`,
    ),
    uniqueIndex('transport_contracts_confirmed_request_unique')
      .on(table.tenantId, table.transportRequestId)
      .where(sql`${table.status} = 'confirmed'`),
    uniqueIndex('transport_contracts_confirmed_assignment_unique')
      .on(table.tenantId, table.capacityAssignmentId)
      .where(sql`${table.status} = 'confirmed'`),
    uniqueIndex('transport_contracts_confirmed_driver_unique')
      .on(table.tenantId, table.driverId)
      .where(sql`${table.status} = 'confirmed'`),
    uniqueIndex('transport_contracts_confirmed_vehicle_unique')
      .on(table.tenantId, table.vehicleId)
      .where(sql`${table.status} = 'confirmed'`),
    index('transport_contracts_request_history_idx').on(
      table.tenantId,
      table.transportRequestId,
      table.createdAt,
    ),
    index('transport_contracts_carrier_status_idx').on(
      table.tenantId,
      table.carrierPartyId,
      table.status,
    ),
    pgPolicy('transport_contracts_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const transportContractEvents = pgTable(
  'transport_contract_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    contractId: uuid('contract_id').notNull(),
    type: transportContractEventTypeEnum('type').notNull(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reason: varchar('reason', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.contractId],
      foreignColumns: [transportContracts.tenantId, transportContracts.id],
      name: 'transport_contract_events_contract_fk',
    }).onDelete('restrict'),
    unique('transport_contract_events_type_unique').on(
      table.tenantId,
      table.contractId,
      table.type,
    ),
    check(
      'transport_contract_events_reason_check',
      sql`${table.type} = 'confirmed' OR length(trim(coalesce(${table.reason}, ''))) > 0`,
    ),
    index('transport_contract_events_contract_created_idx').on(
      table.tenantId,
      table.contractId,
      table.createdAt,
    ),
    pgPolicy('transport_contract_events_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
