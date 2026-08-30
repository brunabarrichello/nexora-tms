import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { capacityAssignments } from './capacity-assignment.js';
import { transportRequests } from './freight.js';
import { users } from './identity.js';
import { businessParties } from './master-data.js';
import { tenantMatchesSession } from './rls.js';

export const freightProposalKindEnum = pgEnum('freight_proposal_kind', [
  'proposal',
  'counterproposal',
]);

export const freightProposalStatusEnum = pgEnum('freight_proposal_status', [
  'open',
  'accepted',
  'rejected',
  'expired',
]);

export const freightProposals = pgTable(
  'freight_proposals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    transportRequestId: uuid('transport_request_id').notNull(),
    capacityAssignmentId: uuid('capacity_assignment_id').notNull(),
    carrierPartyId: uuid('carrier_party_id').notNull(),
    parentProposalId: uuid('parent_proposal_id'),
    sequence: integer('sequence').notNull(),
    kind: freightProposalKindEnum('kind').notNull(),
    currencyCode: varchar('currency_code', { length: 3 }).default('BRL').notNull(),
    freightAmount: numeric('freight_amount', { precision: 14, scale: 2 }).notNull(),
    tollAmount: numeric('toll_amount', { precision: 14, scale: 2 }).default('0').notNull(),
    additionalAmount: numeric('additional_amount', { precision: 14, scale: 2 })
      .default('0')
      .notNull(),
    paymentTerms: varchar('payment_terms', { length: 300 }).notNull(),
    commercialNotes: varchar('commercial_notes', { length: 1000 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    authoredByUserId: uuid('authored_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('freight_proposals_tenant_id_unique').on(table.tenantId, table.id),
    unique('freight_proposals_tenant_request_id_unique').on(
      table.tenantId,
      table.transportRequestId,
      table.id,
    ),
    unique('freight_proposals_request_sequence_unique').on(
      table.tenantId,
      table.transportRequestId,
      table.sequence,
    ),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'freight_proposals_request_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.capacityAssignmentId],
      foreignColumns: [capacityAssignments.tenantId, capacityAssignments.id],
      name: 'freight_proposals_capacity_assignment_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.carrierPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'freight_proposals_carrier_party_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.parentProposalId],
      foreignColumns: [table.tenantId, table.id],
      name: 'freight_proposals_parent_fk',
    }).onDelete('restrict'),
    check('freight_proposals_sequence_check', sql`${table.sequence} > 0`),
    check('freight_proposals_currency_check', sql`${table.currencyCode} ~ '^[A-Z]{3}$'`),
    check('freight_proposals_freight_amount_check', sql`${table.freightAmount} > 0`),
    check('freight_proposals_toll_amount_check', sql`${table.tollAmount} >= 0`),
    check('freight_proposals_additional_amount_check', sql`${table.additionalAmount} >= 0`),
    check('freight_proposals_payment_terms_check', sql`length(trim(${table.paymentTerms})) > 0`),
    check(
      'freight_proposals_parent_kind_check',
      sql`(${table.kind} = 'proposal' AND ${table.parentProposalId} IS NULL) OR (${table.kind} = 'counterproposal' AND ${table.parentProposalId} IS NOT NULL)`,
    ),
    index('freight_proposals_request_created_idx').on(
      table.tenantId,
      table.transportRequestId,
      table.createdAt,
    ),
    index('freight_proposals_assignment_idx').on(
      table.tenantId,
      table.capacityAssignmentId,
      table.createdAt,
    ),
    index('freight_proposals_carrier_idx').on(
      table.tenantId,
      table.carrierPartyId,
      table.createdAt,
    ),
    pgPolicy('freight_proposals_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const freightProposalEvents = pgTable(
  'freight_proposal_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    proposalId: uuid('proposal_id').notNull(),
    status: freightProposalStatusEnum('status').notNull(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reason: varchar('reason', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.proposalId],
      foreignColumns: [freightProposals.tenantId, freightProposals.id],
      name: 'freight_proposal_events_proposal_fk',
    }).onDelete('restrict'),
    unique('freight_proposal_events_status_unique').on(
      table.tenantId,
      table.proposalId,
      table.status,
    ),
    check(
      'freight_proposal_events_reason_check',
      sql`${table.status} <> 'rejected' OR length(trim(coalesce(${table.reason}, ''))) > 0`,
    ),
    index('freight_proposal_events_proposal_created_idx').on(
      table.tenantId,
      table.proposalId,
      table.createdAt,
    ),
    pgPolicy('freight_proposal_events_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
