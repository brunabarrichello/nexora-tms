import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { transportRequests } from './freight.js';
import { users } from './identity.js';
import { businessParties } from './master-data.js';
import { tenants } from './platform.js';
import { documentTypes } from './reference-data.js';
import { tenantMatchesSession } from './rls.js';

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    documentTypeId: uuid('document_type_id').notNull(),
    title: varchar('title', { length: 240 }).notNull(),
    status: varchar('status', { length: 24 }).default('draft').notNull(),
    issuedOn: date('issued_on'),
    expiresOn: date('expires_on'),
    externalReference: varchar('external_reference', { length: 180 }),
    notes: varchar('notes', { length: 1500 }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedByUserId: uuid('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedByUserId: uuid('deleted_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    deleteReason: varchar('delete_reason', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('documents_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.documentTypeId],
      foreignColumns: [documentTypes.tenantId, documentTypes.id],
      name: 'documents_document_type_fk',
    }).onDelete('restrict'),
    check('documents_title_check', sql`length(trim(${table.title})) > 0`),
    check(
      'documents_status_check',
      sql`${table.status} in ('draft','pending','valid','rejected','expired','archived')`,
    ),
    check(
      'documents_dates_check',
      sql`${table.issuedOn} IS NULL OR ${table.expiresOn} IS NULL OR ${table.expiresOn} >= ${table.issuedOn}`,
    ),
    check(
      'documents_soft_delete_check',
      sql`(${table.deletedAt} IS NULL AND ${table.deletedByUserId} IS NULL AND ${table.deleteReason} IS NULL) OR (${table.deletedAt} IS NOT NULL AND ${table.deletedByUserId} IS NOT NULL AND ${table.deleteReason} IS NOT NULL AND length(trim(${table.deleteReason})) > 0)`,
    ),
    index('documents_tenant_status_created_idx').on(table.tenantId, table.status, table.createdAt),
    index('documents_tenant_type_status_idx').on(table.tenantId, table.documentTypeId, table.status),
    index('documents_tenant_expiry_idx').on(table.tenantId, table.expiresOn),
    index('documents_tenant_deleted_idx').on(table.tenantId, table.deletedAt),
    pgPolicy('documents_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const documentVersions = pgTable(
  'document_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    documentId: uuid('document_id').notNull(),
    versionNumber: integer('version_number').notNull(),
    originalFileName: varchar('original_file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 160 }).notNull(),
    byteSize: numeric('byte_size', { precision: 20, scale: 0 }).notNull(),
    checksumSha256: varchar('checksum_sha256', { length: 64 }).notNull(),
    storageProvider: varchar('storage_provider', { length: 64 }).notNull(),
    storageKey: varchar('storage_key', { length: 700 }).notNull(),
    source: varchar('source', { length: 24 }).default('upload').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('document_versions_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('document_versions_tenant_document_id_id_unique').on(
      table.tenantId,
      table.documentId,
      table.id,
    ),
    unique('document_versions_tenant_document_version_unique').on(
      table.tenantId,
      table.documentId,
      table.versionNumber,
    ),
    unique('document_versions_tenant_storage_object_unique').on(
      table.tenantId,
      table.storageProvider,
      table.storageKey,
    ),
    foreignKey({
      columns: [table.tenantId, table.documentId],
      foreignColumns: [documents.tenantId, documents.id],
      name: 'document_versions_document_fk',
    }).onDelete('restrict'),
    check('document_versions_number_check', sql`${table.versionNumber} > 0`),
    check('document_versions_file_name_check', sql`length(trim(${table.originalFileName})) > 0`),
    check('document_versions_mime_type_check', sql`length(trim(${table.mimeType})) > 0`),
    check('document_versions_byte_size_check', sql`${table.byteSize} > 0`),
    check(
      'document_versions_checksum_check',
      sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check('document_versions_storage_provider_check', sql`length(trim(${table.storageProvider})) > 0`),
    check('document_versions_storage_key_check', sql`length(trim(${table.storageKey})) > 0`),
    check(
      'document_versions_source_check',
      sql`${table.source} in ('upload','import','generated','integration')`,
    ),
    index('document_versions_tenant_document_created_idx').on(
      table.tenantId,
      table.documentId,
      table.createdAt,
    ),
    pgPolicy('document_versions_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const documentValidations = pgTable(
  'document_validations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    documentId: uuid('document_id').notNull(),
    documentVersionId: uuid('document_version_id'),
    validationType: varchar('validation_type', { length: 32 }).notNull(),
    result: varchar('result', { length: 24 }).notNull(),
    notes: varchar('notes', { length: 1500 }),
    providerReference: varchar('provider_reference', { length: 180 }),
    details: jsonb('details')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    validatedByUserId: uuid('validated_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    validatedAt: timestamp('validated_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('document_validations_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.documentId],
      foreignColumns: [documents.tenantId, documents.id],
      name: 'document_validations_document_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.documentId, table.documentVersionId],
      foreignColumns: [
        documentVersions.tenantId,
        documentVersions.documentId,
        documentVersions.id,
      ],
      name: 'document_validations_version_fk',
    }).onDelete('restrict'),
    check(
      'document_validations_type_check',
      sql`${table.validationType} in ('manual','system','external')`,
    ),
    check(
      'document_validations_result_check',
      sql`${table.result} in ('valid','invalid','review_required')`,
    ),
    check(
      'document_validations_actor_check',
      sql`${table.validationType} <> 'manual' OR ${table.validatedByUserId} IS NOT NULL`,
    ),
    index('document_validations_tenant_document_time_idx').on(
      table.tenantId,
      table.documentId,
      table.validatedAt,
    ),
    index('document_validations_tenant_result_time_idx').on(
      table.tenantId,
      table.result,
      table.validatedAt,
    ),
    pgPolicy('document_validations_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const businessPartyDocuments = pgTable(
  'business_party_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    businessPartyId: uuid('business_party_id').notNull(),
    documentId: uuid('document_id').notNull(),
    relationType: varchar('relation_type', { length: 32 }).default('registration').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('business_party_documents_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('business_party_documents_tenant_party_document_unique').on(
      table.tenantId,
      table.businessPartyId,
      table.documentId,
    ),
    foreignKey({
      columns: [table.tenantId, table.businessPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'business_party_documents_party_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.documentId],
      foreignColumns: [documents.tenantId, documents.id],
      name: 'business_party_documents_document_fk',
    }).onDelete('restrict'),
    check(
      'business_party_documents_relation_check',
      sql`${table.relationType} in ('registration','compliance','contract','insurance','other')`,
    ),
    index('business_party_documents_tenant_party_idx').on(table.tenantId, table.businessPartyId),
    pgPolicy('business_party_documents_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const transportRequestDocuments = pgTable(
  'transport_request_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    transportRequestId: uuid('transport_request_id').notNull(),
    documentId: uuid('document_id').notNull(),
    relationType: varchar('relation_type', { length: 32 }).default('request').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('transport_request_documents_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('transport_request_documents_tenant_request_document_unique').on(
      table.tenantId,
      table.transportRequestId,
      table.documentId,
    ),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'transport_request_documents_request_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.documentId],
      foreignColumns: [documents.tenantId, documents.id],
      name: 'transport_request_documents_document_fk',
    }).onDelete('restrict'),
    check(
      'transport_request_documents_relation_check',
      sql`${table.relationType} in ('request','commercial','compliance','reference','other')`,
    ),
    index('transport_request_documents_tenant_request_idx').on(
      table.tenantId,
      table.transportRequestId,
    ),
    pgPolicy('transport_request_documents_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
