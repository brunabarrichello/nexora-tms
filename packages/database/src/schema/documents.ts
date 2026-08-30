import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { capacityAssetDocuments, driverDocuments } from './capacity-qualification.js';
import { capacityAssets, drivers } from './capacity.js';
import { transportRequests } from './freight.js';
import { users } from './identity.js';
import { businessParties } from './master-data.js';
import { tenants } from './platform.js';
import { documentTypes } from './reference-data.js';
import { tenantMatchesSession } from './rls.js';
import { transportContracts } from './transport-contract.js';

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    documentTypeId: uuid('document_type_id').notNull(),
    title: varchar('title', { length: 240 }).notNull(),
    documentNumber: varchar('document_number', { length: 120 }),
    issuer: varchar('issuer', { length: 180 }),
    issuedOn: date('issued_on'),
    expiresOn: date('expires_on'),
    status: varchar('status', { length: 24 }).default('draft').notNull(),
    validationStatus: varchar('validation_status', { length: 24 }).default('pending').notNull(),
    currentVersionNumber: integer('current_version_number').default(0).notNull(),
    isBlocking: boolean('is_blocking').default(false).notNull(),
    notes: varchar('notes', { length: 1500 }),
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
    unique('documents_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.documentTypeId],
      foreignColumns: [documentTypes.tenantId, documentTypes.id],
      name: 'documents_document_type_fk',
    }).onDelete('restrict'),
    check('documents_title_check', sql`length(trim(${table.title})) > 0`),
    check(
      'documents_dates_check',
      sql`${table.issuedOn} IS NULL OR ${table.expiresOn} IS NULL OR ${table.expiresOn} >= ${table.issuedOn}`,
    ),
    check(
      'documents_status_check',
      sql`${table.status} in ('draft','active','expired','blocked','archived')`,
    ),
    check(
      'documents_validation_status_check',
      sql`${table.validationStatus} in ('pending','validated','rejected','not_required')`,
    ),
    check('documents_version_check', sql`${table.currentVersionNumber} >= 0`),
    index('documents_tenant_status_idx').on(table.tenantId, table.status),
    index('documents_tenant_validation_idx').on(table.tenantId, table.validationStatus),
    index('documents_tenant_expiry_idx').on(table.tenantId, table.expiresOn),
    index('documents_tenant_type_idx').on(table.tenantId, table.documentTypeId),
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
    storageProvider: varchar('storage_provider', { length: 32 }).notNull(),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 160 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    source: varchar('source', { length: 32 }).default('upload').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    uploadedByUserId: uuid('uploaded_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('document_versions_tenant_document_id_unique').on(
      table.tenantId,
      table.documentId,
      table.id,
    ),
    unique('document_versions_tenant_document_version_unique').on(
      table.tenantId,
      table.documentId,
      table.versionNumber,
    ),
    unique('document_versions_tenant_storage_unique').on(
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
    check('document_versions_storage_key_check', sql`length(trim(${table.storageKey})) > 0`),
    check('document_versions_file_name_check', sql`length(trim(${table.fileName})) > 0`),
    check('document_versions_mime_type_check', sql`length(trim(${table.mimeType})) > 0`),
    check('document_versions_size_check', sql`${table.sizeBytes} > 0`),
    check('document_versions_sha256_check', sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
    check(
      'document_versions_provider_check',
      sql`${table.storageProvider} in ('s3','gcs','azure','local','external','other')`,
    ),
    check(
      'document_versions_source_check',
      sql`${table.source} in ('upload','integration','migration','generated')`,
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
    versionId: uuid('version_id'),
    validationType: varchar('validation_type', { length: 32 }).notNull(),
    status: varchar('status', { length: 24 }).notNull(),
    validatorUserId: uuid('validator_user_id').references(() => users.id, { onDelete: 'restrict' }),
    validatedAt: timestamp('validated_at', { withTimezone: true }),
    provider: varchar('provider', { length: 120 }),
    ruleCode: varchar('rule_code', { length: 120 }),
    details: jsonb('details').$type<Record<string, unknown>>().default({}).notNull(),
    notes: varchar('notes', { length: 1500 }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
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
      columns: [table.tenantId, table.documentId, table.versionId],
      foreignColumns: [
        documentVersions.tenantId,
        documentVersions.documentId,
        documentVersions.id,
      ],
      name: 'document_validations_version_fk',
    }).onDelete('restrict'),
    check(
      'document_validations_type_check',
      sql`${table.validationType} in ('manual','automated','antifraud','compliance','other')`,
    ),
    check(
      'document_validations_status_check',
      sql`${table.status} in ('pending','validated','rejected','warning','not_applicable')`,
    ),
    check(
      'document_validations_completion_check',
      sql`(${table.status} = 'pending' AND ${table.validatedAt} IS NULL) OR (${table.status} <> 'pending' AND ${table.validatedAt} IS NOT NULL)`,
    ),
    index('document_validations_tenant_document_created_idx').on(
      table.tenantId,
      table.documentId,
      table.createdAt,
    ),
    index('document_validations_tenant_status_idx').on(table.tenantId, table.status),
    pgPolicy('document_validations_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const documentLinks = pgTable(
  'document_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    documentId: uuid('document_id').notNull(),
    targetKind: varchar('target_kind', { length: 32 }).notNull(),
    relationType: varchar('relation_type', { length: 64 }).default('attachment').notNull(),
    partyId: uuid('party_id'),
    driverId: uuid('driver_id'),
    driverDocumentId: uuid('driver_document_id'),
    assetId: uuid('asset_id'),
    assetDocumentId: uuid('asset_document_id'),
    transportRequestId: uuid('transport_request_id'),
    transportContractId: uuid('transport_contract_id'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    unlinkedAt: timestamp('unlinked_at', { withTimezone: true }),
    unlinkedByUserId: uuid('unlinked_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    unlinkReason: varchar('unlink_reason', { length: 1000 }),
  },
  (table) => [
    unique('document_links_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.documentId],
      foreignColumns: [documents.tenantId, documents.id],
      name: 'document_links_document_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.partyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'document_links_party_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'document_links_driver_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.driverDocumentId],
      foreignColumns: [driverDocuments.tenantId, driverDocuments.id],
      name: 'document_links_driver_document_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.assetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'document_links_asset_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.assetDocumentId],
      foreignColumns: [capacityAssetDocuments.tenantId, capacityAssetDocuments.id],
      name: 'document_links_asset_document_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'document_links_request_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.transportContractId],
      foreignColumns: [transportContracts.tenantId, transportContracts.id],
      name: 'document_links_contract_fk',
    }).onDelete('restrict'),
    check(
      'document_links_target_kind_check',
      sql`${table.targetKind} in ('party','driver','driver_document','asset','asset_document','request','contract')`,
    ),
    check('document_links_relation_check', sql`length(trim(${table.relationType})) > 0`),
    check(
      'document_links_exactly_one_target_check',
      sql`(
        (${table.partyId} IS NOT NULL)::int +
        (${table.driverId} IS NOT NULL)::int +
        (${table.driverDocumentId} IS NOT NULL)::int +
        (${table.assetId} IS NOT NULL)::int +
        (${table.assetDocumentId} IS NOT NULL)::int +
        (${table.transportRequestId} IS NOT NULL)::int +
        (${table.transportContractId} IS NOT NULL)::int
      ) = 1`,
    ),
    check(
      'document_links_kind_target_check',
      sql`(
        (${table.targetKind} = 'party' AND ${table.partyId} IS NOT NULL) OR
        (${table.targetKind} = 'driver' AND ${table.driverId} IS NOT NULL) OR
        (${table.targetKind} = 'driver_document' AND ${table.driverDocumentId} IS NOT NULL) OR
        (${table.targetKind} = 'asset' AND ${table.assetId} IS NOT NULL) OR
        (${table.targetKind} = 'asset_document' AND ${table.assetDocumentId} IS NOT NULL) OR
        (${table.targetKind} = 'request' AND ${table.transportRequestId} IS NOT NULL) OR
        (${table.targetKind} = 'contract' AND ${table.transportContractId} IS NOT NULL)
      )`,
    ),
    check(
      'document_links_unlink_check',
      sql`(${table.unlinkedAt} IS NULL AND ${table.unlinkedByUserId} IS NULL AND ${table.unlinkReason} IS NULL) OR (${table.unlinkedAt} IS NOT NULL AND ${table.unlinkedByUserId} IS NOT NULL AND length(trim(coalesce(${table.unlinkReason}, ''))) > 0)`,
    ),
    uniqueIndex('document_links_active_party_unique')
      .on(table.tenantId, table.documentId, table.partyId, table.relationType)
      .where(sql`${table.partyId} IS NOT NULL AND ${table.unlinkedAt} IS NULL`),
    uniqueIndex('document_links_active_driver_unique')
      .on(table.tenantId, table.documentId, table.driverId, table.relationType)
      .where(sql`${table.driverId} IS NOT NULL AND ${table.unlinkedAt} IS NULL`),
    uniqueIndex('document_links_active_driver_document_unique')
      .on(table.tenantId, table.documentId, table.driverDocumentId, table.relationType)
      .where(sql`${table.driverDocumentId} IS NOT NULL AND ${table.unlinkedAt} IS NULL`),
    uniqueIndex('document_links_active_asset_unique')
      .on(table.tenantId, table.documentId, table.assetId, table.relationType)
      .where(sql`${table.assetId} IS NOT NULL AND ${table.unlinkedAt} IS NULL`),
    uniqueIndex('document_links_active_asset_document_unique')
      .on(table.tenantId, table.documentId, table.assetDocumentId, table.relationType)
      .where(sql`${table.assetDocumentId} IS NOT NULL AND ${table.unlinkedAt} IS NULL`),
    uniqueIndex('document_links_active_request_unique')
      .on(table.tenantId, table.documentId, table.transportRequestId, table.relationType)
      .where(sql`${table.transportRequestId} IS NOT NULL AND ${table.unlinkedAt} IS NULL`),
    uniqueIndex('document_links_active_contract_unique')
      .on(table.tenantId, table.documentId, table.transportContractId, table.relationType)
      .where(sql`${table.transportContractId} IS NOT NULL AND ${table.unlinkedAt} IS NULL`),
    index('document_links_tenant_document_active_idx').on(
      table.tenantId,
      table.documentId,
      table.unlinkedAt,
    ),
    pgPolicy('document_links_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
