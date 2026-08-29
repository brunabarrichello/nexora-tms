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
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './identity.js';
import { businessPartyAddresses } from './master-data-directory.js';
import { businessParties } from './master-data.js';
import { tenantMatchesSession } from './rls.js';

export const transportRequestStatusEnum = pgEnum('transport_request_status', [
  'draft',
  'ready_for_quote',
  'in_negotiation',
  'contracted',
  'cancelled',
]);

export const transportRequests = pgTable(
  'transport_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    customerPartyId: uuid('customer_party_id').notNull(),
    shipperPartyId: uuid('shipper_party_id').notNull(),
    consigneePartyId: uuid('consignee_party_id').notNull(),
    originAddressId: uuid('origin_address_id').notNull(),
    destinationAddressId: uuid('destination_address_id').notNull(),
    plannedPickupAt: timestamp('planned_pickup_at', { withTimezone: true }).notNull(),
    plannedDeliveryAt: timestamp('planned_delivery_at', { withTimezone: true }).notNull(),
    cargoDescription: varchar('cargo_description', { length: 1000 }).notNull(),
    status: transportRequestStatusEnum('status').default('draft').notNull(),
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
    unique('transport_requests_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.customerPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'transport_requests_customer_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.shipperPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'transport_requests_shipper_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.consigneePartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'transport_requests_consignee_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.shipperPartyId, table.originAddressId],
      foreignColumns: [
        businessPartyAddresses.tenantId,
        businessPartyAddresses.partyId,
        businessPartyAddresses.id,
      ],
      name: 'transport_requests_origin_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.consigneePartyId, table.destinationAddressId],
      foreignColumns: [
        businessPartyAddresses.tenantId,
        businessPartyAddresses.partyId,
        businessPartyAddresses.id,
      ],
      name: 'transport_requests_destination_fk',
    }).onDelete('restrict'),
    check(
      'transport_requests_planned_window_check',
      sql`${table.plannedDeliveryAt} >= ${table.plannedPickupAt}`,
    ),
    check(
      'transport_requests_distinct_addresses_check',
      sql`${table.originAddressId} <> ${table.destinationAddressId}`,
    ),
    index('transport_requests_tenant_status_idx').on(table.tenantId, table.status),
    index('transport_requests_tenant_pickup_idx').on(table.tenantId, table.plannedPickupAt),
    index('transport_requests_tenant_customer_idx').on(table.tenantId, table.customerPartyId),
    pgPolicy('transport_requests_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
