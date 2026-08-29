import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { transportRequests } from './freight.js';
import { users } from './identity.js';
import { tenantMatchesSession } from './rls.js';

export const commercialTermsStatusEnum = pgEnum('commercial_terms_status', [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
]);

export const transportRequestCommercialTerms = pgTable(
  'transport_request_commercial_terms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    transportRequestId: uuid('transport_request_id').notNull(),
    currencyCode: varchar('currency_code', { length: 3 }).default('BRL').notNull(),
    customerPrice: numeric('customer_price', { precision: 14, scale: 2 }),
    targetCarrierFreight: numeric('target_carrier_freight', { precision: 14, scale: 2 }).notNull(),
    tollAmount: numeric('toll_amount', { precision: 14, scale: 2 }).default('0').notNull(),
    additionalAmount: numeric('additional_amount', { precision: 14, scale: 2 })
      .default('0')
      .notNull(),
    paymentTerms: varchar('payment_terms', { length: 300 }).notNull(),
    commercialNotes: varchar('commercial_notes', { length: 1000 }),
    status: commercialTermsStatusEnum('status').default('draft').notNull(),
    approvalNote: varchar('approval_note', { length: 1000 }),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    version: integer('version').default(1).notNull(),
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
    unique('transport_request_commercial_terms_tenant_request_unique').on(
      table.tenantId,
      table.transportRequestId,
    ),
    unique('transport_request_commercial_terms_tenant_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'transport_request_commercial_terms_request_fk',
    }).onDelete('cascade'),
    check(
      'transport_request_commercial_terms_currency_check',
      sql`${table.currencyCode} ~ '^[A-Z]{3}$'`,
    ),
    check(
      'transport_request_commercial_terms_customer_price_check',
      sql`${table.customerPrice} is null OR ${table.customerPrice} >= 0`,
    ),
    check(
      'transport_request_commercial_terms_carrier_freight_check',
      sql`${table.targetCarrierFreight} > 0`,
    ),
    check('transport_request_commercial_terms_toll_check', sql`${table.tollAmount} >= 0`),
    check(
      'transport_request_commercial_terms_additional_check',
      sql`${table.additionalAmount} >= 0`,
    ),
    check(
      'transport_request_commercial_terms_payment_check',
      sql`length(trim(${table.paymentTerms})) > 0`,
    ),
    check('transport_request_commercial_terms_version_check', sql`${table.version} > 0`),
    check(
      'transport_request_commercial_terms_approval_check',
      sql`${table.status} <> 'approved' OR (${table.approvedByUserId} is not null AND ${table.approvedAt} is not null)`,
    ),
    index('transport_request_commercial_terms_tenant_status_idx').on(table.tenantId, table.status),
    pgPolicy('transport_request_commercial_terms_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const transportRequestCommercialHistory = pgTable(
  'transport_request_commercial_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    transportRequestId: uuid('transport_request_id').notNull(),
    commercialTermsId: uuid('commercial_terms_id').notNull(),
    version: integer('version').notNull(),
    eventType: varchar('event_type', { length: 32 }).notNull(),
    status: commercialTermsStatusEnum('status').notNull(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    snapshot: jsonb('snapshot').notNull(),
    note: varchar('note', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('transport_request_commercial_history_terms_version_unique').on(
      table.tenantId,
      table.commercialTermsId,
      table.version,
    ),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'transport_request_commercial_history_request_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tenantId, table.commercialTermsId],
      foreignColumns: [
        transportRequestCommercialTerms.tenantId,
        transportRequestCommercialTerms.id,
      ],
      name: 'transport_request_commercial_history_terms_fk',
    }).onDelete('cascade'),
    check('transport_request_commercial_history_version_check', sql`${table.version} > 0`),
    check(
      'transport_request_commercial_history_event_check',
      sql`${table.eventType} in ('created','updated','submitted','approved','rejected')`,
    ),
    index('transport_request_commercial_history_request_idx').on(
      table.tenantId,
      table.transportRequestId,
      table.version,
    ),
    pgPolicy('transport_request_commercial_history_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
