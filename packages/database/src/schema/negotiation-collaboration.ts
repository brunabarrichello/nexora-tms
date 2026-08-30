import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { transportRequests } from './freight.js';
import { memberships } from './identity.js';
import { businessPartyContacts } from './master-data-directory.js';
import { businessParties } from './master-data.js';
import { freightProposals } from './negotiation.js';
import { tenantMatchesSession } from './rls.js';

export const negotiationThreadStatusEnum = pgEnum('negotiation_thread_status', [
  'open',
  'closed',
  'cancelled',
]);

export const negotiationParticipantKindEnum = pgEnum('negotiation_participant_kind', [
  'internal',
  'external',
]);

export const negotiationParticipantRoleEnum = pgEnum('negotiation_participant_role', [
  'operator',
  'commercial',
  'carrier',
  'driver',
  'observer',
]);

export const negotiationMessageKindEnum = pgEnum('negotiation_message_kind', [
  'message',
  'note',
  'system',
]);

export const negotiationThreads = pgTable(
  'negotiation_threads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    transportRequestId: uuid('transport_request_id').notNull(),
    subject: varchar('subject', { length: 240 }).notNull(),
    status: negotiationThreadStatusEnum('status').default('open').notNull(),
    createdByMembershipId: uuid('created_by_membership_id').notNull(),
    closedByMembershipId: uuid('closed_by_membership_id'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('negotiation_threads_tenant_id_unique').on(table.tenantId, table.id),
    unique('negotiation_threads_tenant_request_id_unique').on(
      table.tenantId,
      table.transportRequestId,
      table.id,
    ),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'negotiation_threads_request_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.createdByMembershipId],
      foreignColumns: [memberships.tenantId, memberships.id],
      name: 'negotiation_threads_created_by_membership_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.closedByMembershipId],
      foreignColumns: [memberships.tenantId, memberships.id],
      name: 'negotiation_threads_closed_by_membership_fk',
    }).onDelete('restrict'),
    check('negotiation_threads_subject_check', sql`length(trim(${table.subject})) > 0`),
    check(
      'negotiation_threads_close_state_check',
      sql`(${table.status} = 'open' AND ${table.closedAt} IS NULL AND ${table.closedByMembershipId} IS NULL) OR (${table.status} IN ('closed', 'cancelled') AND ${table.closedAt} IS NOT NULL AND ${table.closedByMembershipId} IS NOT NULL)`,
    ),
    index('negotiation_threads_request_status_idx').on(
      table.tenantId,
      table.transportRequestId,
      table.status,
      table.updatedAt,
    ),
    pgPolicy('negotiation_threads_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const negotiationParticipants = pgTable(
  'negotiation_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    threadId: uuid('thread_id').notNull(),
    kind: negotiationParticipantKindEnum('kind').notNull(),
    role: negotiationParticipantRoleEnum('role').notNull(),
    membershipId: uuid('membership_id'),
    businessPartyId: uuid('business_party_id'),
    businessPartyContactId: uuid('business_party_contact_id'),
    addedByMembershipId: uuid('added_by_membership_id').notNull(),
    removedByMembershipId: uuid('removed_by_membership_id'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (table) => [
    unique('negotiation_participants_tenant_id_unique').on(table.tenantId, table.id),
    unique('negotiation_participants_thread_id_unique').on(table.tenantId, table.threadId, table.id),
    foreignKey({
      columns: [table.tenantId, table.threadId],
      foreignColumns: [negotiationThreads.tenantId, negotiationThreads.id],
      name: 'negotiation_participants_thread_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.membershipId],
      foreignColumns: [memberships.tenantId, memberships.id],
      name: 'negotiation_participants_membership_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.businessPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'negotiation_participants_business_party_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.businessPartyId, table.businessPartyContactId],
      foreignColumns: [
        businessPartyContacts.tenantId,
        businessPartyContacts.partyId,
        businessPartyContacts.id,
      ],
      name: 'negotiation_participants_business_party_contact_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.addedByMembershipId],
      foreignColumns: [memberships.tenantId, memberships.id],
      name: 'negotiation_participants_added_by_membership_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.removedByMembershipId],
      foreignColumns: [memberships.tenantId, memberships.id],
      name: 'negotiation_participants_removed_by_membership_fk',
    }).onDelete('restrict'),
    check(
      'negotiation_participants_identity_check',
      sql`(${table.kind} = 'internal' AND ${table.membershipId} IS NOT NULL AND ${table.businessPartyId} IS NULL AND ${table.businessPartyContactId} IS NULL) OR (${table.kind} = 'external' AND ${table.membershipId} IS NULL AND ${table.businessPartyId} IS NOT NULL)`,
    ),
    check(
      'negotiation_participants_removal_check',
      sql`(${table.leftAt} IS NULL AND ${table.removedByMembershipId} IS NULL) OR (${table.leftAt} IS NOT NULL AND ${table.removedByMembershipId} IS NOT NULL)`,
    ),
    uniqueIndex('negotiation_participants_active_internal_unique')
      .on(table.tenantId, table.threadId, table.membershipId)
      .where(sql`${table.kind} = 'internal' AND ${table.leftAt} IS NULL`),
    uniqueIndex('negotiation_participants_active_external_contact_unique')
      .on(table.tenantId, table.threadId, table.businessPartyId, table.businessPartyContactId)
      .where(
        sql`${table.kind} = 'external' AND ${table.businessPartyContactId} IS NOT NULL AND ${table.leftAt} IS NULL`,
      ),
    uniqueIndex('negotiation_participants_active_external_party_unique')
      .on(table.tenantId, table.threadId, table.businessPartyId)
      .where(
        sql`${table.kind} = 'external' AND ${table.businessPartyContactId} IS NULL AND ${table.leftAt} IS NULL`,
      ),
    index('negotiation_participants_thread_active_idx').on(
      table.tenantId,
      table.threadId,
      table.leftAt,
    ),
    pgPolicy('negotiation_participants_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const negotiationMessages = pgTable(
  'negotiation_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    threadId: uuid('thread_id').notNull(),
    transportRequestId: uuid('transport_request_id').notNull(),
    authorParticipantId: uuid('author_participant_id'),
    kind: negotiationMessageKindEnum('kind').default('message').notNull(),
    body: text('body').notNull(),
    relatedProposalId: uuid('related_proposal_id'),
    replyToMessageId: uuid('reply_to_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('negotiation_messages_tenant_id_unique').on(table.tenantId, table.id),
    unique('negotiation_messages_thread_id_unique').on(table.tenantId, table.threadId, table.id),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId, table.threadId],
      foreignColumns: [
        negotiationThreads.tenantId,
        negotiationThreads.transportRequestId,
        negotiationThreads.id,
      ],
      name: 'negotiation_messages_thread_request_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.threadId, table.authorParticipantId],
      foreignColumns: [
        negotiationParticipants.tenantId,
        negotiationParticipants.threadId,
        negotiationParticipants.id,
      ],
      name: 'negotiation_messages_author_participant_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId, table.relatedProposalId],
      foreignColumns: [
        freightProposals.tenantId,
        freightProposals.transportRequestId,
        freightProposals.id,
      ],
      name: 'negotiation_messages_related_proposal_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.threadId, table.replyToMessageId],
      foreignColumns: [
        negotiationMessages.tenantId,
        negotiationMessages.threadId,
        negotiationMessages.id,
      ],
      name: 'negotiation_messages_reply_fk',
    }).onDelete('restrict'),
    check('negotiation_messages_body_check', sql`length(trim(${table.body})) BETWEEN 1 AND 8000`),
    check(
      'negotiation_messages_author_check',
      sql`(${table.kind} = 'system' AND ${table.authorParticipantId} IS NULL) OR (${table.kind} <> 'system' AND ${table.authorParticipantId} IS NOT NULL)`,
    ),
    index('negotiation_messages_thread_created_idx').on(
      table.tenantId,
      table.threadId,
      table.createdAt,
    ),
    index('negotiation_messages_proposal_idx').on(
      table.tenantId,
      table.relatedProposalId,
      table.createdAt,
    ),
    pgPolicy('negotiation_messages_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
