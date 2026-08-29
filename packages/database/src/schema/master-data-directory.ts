import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { businessParties } from './master-data.js';
import { tenantMatchesSession } from './rls.js';

export const businessPartyAddresses = pgTable(
  'business_party_addresses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    partyId: uuid('party_id').notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    label: varchar('label', { length: 160 }).notNull(),
    postalCode: varchar('postal_code', { length: 16 }),
    street: varchar('street', { length: 200 }).notNull(),
    number: varchar('number', { length: 40 }),
    complement: varchar('complement', { length: 160 }),
    district: varchar('district', { length: 120 }),
    city: varchar('city', { length: 120 }).notNull(),
    state: varchar('state', { length: 2 }).notNull(),
    countryCode: varchar('country_code', { length: 2 }).default('BR').notNull(),
    operationalReference: varchar('operational_reference', { length: 500 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('business_party_addresses_tenant_party_id_unique').on(
      table.tenantId,
      table.partyId,
      table.id,
    ),
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'business_party_addresses_party_fk',
    }).onDelete('restrict'),
    check(
      'business_party_addresses_type_check',
      sql`${table.type} in ('billing', 'pickup', 'delivery', 'operational', 'other')`,
    ),
    check('business_party_addresses_state_check', sql`${table.state} ~ '^[A-Z]{2}$'`),
    check('business_party_addresses_country_check', sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
    index('business_party_addresses_tenant_party_active_idx').on(
      table.tenantId,
      table.partyId,
      table.isActive,
    ),
    index('business_party_addresses_tenant_city_state_idx').on(
      table.tenantId,
      table.city,
      table.state,
    ),
    pgPolicy('business_party_addresses_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const businessPartyContacts = pgTable(
  'business_party_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    partyId: uuid('party_id').notNull(),
    addressId: uuid('address_id'),
    type: varchar('type', { length: 32 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    title: varchar('title', { length: 120 }),
    email: varchar('email', { length: 254 }),
    phone: varchar('phone', { length: 32 }),
    whatsapp: varchar('whatsapp', { length: 32 }),
    operationalReference: varchar('operational_reference', { length: 500 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('business_party_contacts_tenant_party_id_unique').on(
      table.tenantId,
      table.partyId,
      table.id,
    ),
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'business_party_contacts_party_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.partyId, table.addressId],
      foreignColumns: [
        businessPartyAddresses.tenantId,
        businessPartyAddresses.partyId,
        businessPartyAddresses.id,
      ],
      name: 'business_party_contacts_address_fk',
    }).onDelete('restrict'),
    check(
      'business_party_contacts_type_check',
      sql`${table.type} in ('commercial', 'logistics', 'billing', 'pickup', 'delivery', 'operational', 'other')`,
    ),
    check(
      'business_party_contacts_channel_check',
      sql`${table.email} is not null OR ${table.phone} is not null OR ${table.whatsapp} is not null`,
    ),
    index('business_party_contacts_tenant_party_active_idx').on(
      table.tenantId,
      table.partyId,
      table.isActive,
    ),
    index('business_party_contacts_tenant_address_idx').on(table.tenantId, table.addressId),
    pgPolicy('business_party_contacts_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
