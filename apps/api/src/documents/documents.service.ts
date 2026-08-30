import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  DOCUMENT_STORAGE_PORT,
  type DocumentStoragePort,
  type PreparedDocumentDownload,
  type PreparedDocumentUpload,
} from './document-storage.port.js';
import {
  parseCommitUpload,
  parseCreateDocument,
  parseDeleteDocument,
  parseDocumentValidation,
  parsePartyLink,
  parsePrepareUpload,
  parseTransportRequestLink,
  parseUpdateDocument,
  requireUuid,
} from './documents.validation.js';

export type DocumentRecord = Readonly<Record<string, unknown>>;

interface DocumentState {
  readonly id: string;
  readonly document_type_id: string;
  readonly subject_scope: string;
  readonly has_expiry: boolean;
  readonly requires_validation: boolean;
  readonly title: string;
  readonly status: string;
  readonly issued_on: string | null;
  readonly expires_on: string | null;
  readonly effective_status: string;
  readonly deleted_at: Date | null;
}

interface VersionState {
  readonly id: string;
  readonly document_id: string;
  readonly storage_provider: string;
  readonly storage_key: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
    @Inject(DOCUMENT_STORAGE_PORT) private readonly storage: DocumentStoragePort,
  ) {}

  list(): Promise<readonly DocumentRecord[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<DocumentRecord>(`${documentSelect}
        WHERE d.deleted_at IS NULL
        ORDER BY d.created_at DESC,d.id`);
      return result.rows;
    });
  }

  getById(id: string): Promise<DocumentRecord> {
    const documentId = requireUuid(id, 'documentId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, (client) =>
      this.requireDocumentRecord(client, documentId),
    );
  }

  async create(input: unknown): Promise<DocumentRecord> {
    const data = parseCreateDocument(input);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        const type = await this.requireDocumentType(client, data.documentTypeId);
        if (type.has_expiry && !data.expiresOn)
          throw new BadRequestException('expiresOn is required for this document type');

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO documents (
             tenant_id,document_type_id,title,status,issued_on,expires_on,external_reference,notes,metadata,
             created_by_user_id,updated_by_user_id
           ) VALUES ($1::uuid,$2::uuid,$3,'draft',$4::date,$5::date,$6,$7,$8::jsonb,$9::uuid,$9::uuid)
           RETURNING id::text AS id`,
          [
            context.tenantId,
            data.documentTypeId,
            data.title,
            data.issuedOn,
            data.expiresOn,
            data.externalReference,
            data.notes,
            JSON.stringify(data.metadata),
            context.userId,
          ],
        );
        return this.requireDocumentRecord(client, inserted.rows[0]!.id);
      }),
    );
  }

  async update(id: string, input: unknown): Promise<DocumentRecord> {
    const documentId = requireUuid(id, 'documentId');
    const data = parseUpdateDocument(input);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        const current = await this.requireDocumentState(client, documentId, true);
        const issuedOn = data.issuedOn === undefined ? current.issued_on : data.issuedOn;
        const expiresOn = data.expiresOn === undefined ? current.expires_on : data.expiresOn;
        this.validateDates(issuedOn, expiresOn);
        if (current.has_expiry && !expiresOn)
          throw new BadRequestException('expiresOn is required for this document type');

        await client.query(
          `UPDATE documents SET
             title=$1,
             issued_on=$2::date,
             expires_on=$3::date,
             external_reference=$4,
             notes=$5,
             metadata=$6::jsonb,
             updated_by_user_id=$7::uuid,
             updated_at=now()
           WHERE id=$8::uuid AND deleted_at IS NULL`,
          [
            data.title ?? current.title,
            issuedOn,
            expiresOn,
            data.externalReference === undefined
              ? await this.scalar<string | null>(client, 'external_reference', documentId)
              : data.externalReference,
            data.notes === undefined
              ? await this.scalar<string | null>(client, 'notes', documentId)
              : data.notes,
            JSON.stringify(
              data.metadata === undefined
                ? await this.scalar<Record<string, unknown>>(client, 'metadata', documentId)
                : data.metadata,
            ),
            context.userId,
            documentId,
          ],
        );
        return this.requireDocumentRecord(client, documentId);
      }),
    );
  }

  async softDelete(id: string, input: unknown): Promise<DocumentRecord> {
    const documentId = requireUuid(id, 'documentId');
    const data = parseDeleteDocument(input);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        await this.requireDocumentState(client, documentId, true);
        const result = await client.query(
          `UPDATE documents
             SET status='archived',deleted_at=now(),deleted_by_user_id=$1::uuid,delete_reason=$2,
                 updated_by_user_id=$1::uuid,updated_at=now()
           WHERE id=$3::uuid AND deleted_at IS NULL`,
          [context.userId, data.reason, documentId],
        );
        if (result.rowCount !== 1) throw new NotFoundException('document not found');
        const archived = await client.query<DocumentRecord>(`${documentSelect}
          WHERE d.id=$1::uuid`, [documentId]);
        return archived.rows[0]!;
      }),
    );
  }

  async prepareUpload(id: string, input: unknown): Promise<PreparedDocumentUpload> {
    const documentId = requireUuid(id, 'documentId');
    const data = parsePrepareUpload(input);
    const context = this.tenantContext.require();
    await this.database.withTenantContext(context, (client) =>
      this.requireDocumentState(client, documentId),
    );
    return this.storage.prepareUpload({
      tenantId: context.tenantId,
      documentId,
      originalFileName: data.originalFileName,
      mimeType: data.mimeType,
      expectedByteSize: data.expectedByteSize,
      checksumSha256: data.checksumSha256,
    });
  }

  async commitUpload(id: string, input: unknown): Promise<DocumentRecord> {
    const documentId = requireUuid(id, 'documentId');
    const data = parseCommitUpload(input);
    const context = this.tenantContext.require();
    const object = await this.storage.verifyUpload({
      tenantId: context.tenantId,
      documentId,
      uploadId: data.uploadId,
    });

    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        const document = await this.requireDocumentState(client, documentId, true);
        const nextVersion = await client.query<{ version_number: number }>(
          `SELECT coalesce(max(version_number),0)::int + 1 AS version_number
             FROM document_versions
            WHERE document_id=$1::uuid`,
          [documentId],
        );
        await client.query(
          `INSERT INTO document_versions (
             tenant_id,document_id,version_number,original_file_name,mime_type,byte_size,checksum_sha256,
             storage_provider,storage_key,source,metadata,created_by_user_id
           ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::uuid)`,
          [
            context.tenantId,
            documentId,
            nextVersion.rows[0]!.version_number,
            object.originalFileName,
            object.mimeType,
            object.byteSize,
            object.checksumSha256.toLowerCase(),
            object.storageProvider,
            object.storageKey,
            data.source,
            JSON.stringify(data.metadata),
            context.userId,
          ],
        );

        const nextStatus = document.requires_validation
          ? 'pending'
          : this.expiryAwareStatus(document.expires_on, 'valid');
        await client.query(
          `UPDATE documents
              SET status=$1,updated_by_user_id=$2::uuid,updated_at=now()
            WHERE id=$3::uuid AND deleted_at IS NULL`,
          [nextStatus, context.userId, documentId],
        );
        return this.requireDocumentRecord(client, documentId);
      }),
    );
  }

  listVersions(id: string): Promise<readonly DocumentRecord[]> {
    const documentId = requireUuid(id, 'documentId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireDocumentState(client, documentId);
      const result = await client.query<DocumentRecord>(
        `SELECT id,document_id,version_number,original_file_name,mime_type,byte_size,checksum_sha256,
                source,metadata,created_by_user_id,created_at
           FROM document_versions
          WHERE document_id=$1::uuid
          ORDER BY version_number DESC`,
        [documentId],
      );
      return result.rows;
    });
  }

  async prepareDownload(id: string, versionId: string): Promise<PreparedDocumentDownload> {
    const documentId = requireUuid(id, 'documentId');
    const version = requireUuid(versionId, 'versionId');
    const context = this.tenantContext.require();
    const object = await this.database.withTenantContext(context, async (client) => {
      await this.requireDocumentState(client, documentId);
      const result = await client.query<VersionState>(
        `SELECT id::text AS id,document_id::text AS document_id,storage_provider,storage_key
           FROM document_versions
          WHERE id=$1::uuid AND document_id=$2::uuid`,
        [version, documentId],
      );
      if (!result.rows[0]) throw new NotFoundException('document version not found');
      return result.rows[0];
    });
    return this.storage.createDownloadUrl({
      tenantId: context.tenantId,
      documentId,
      versionId: object.id,
      storageProvider: object.storage_provider,
      storageKey: object.storage_key,
    });
  }

  listValidations(id: string): Promise<readonly DocumentRecord[]> {
    const documentId = requireUuid(id, 'documentId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireDocumentState(client, documentId);
      const result = await client.query<DocumentRecord>(
        `SELECT * FROM document_validations
          WHERE document_id=$1::uuid
          ORDER BY validated_at DESC,id`,
        [documentId],
      );
      return result.rows;
    });
  }

  async validate(id: string, input: unknown): Promise<DocumentRecord> {
    const documentId = requireUuid(id, 'documentId');
    const data = parseDocumentValidation(input);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        const document = await this.requireDocumentState(client, documentId, true);
        if (data.documentVersionId) {
          const version = await client.query(
            `SELECT 1 FROM document_versions
              WHERE id=$1::uuid AND document_id=$2::uuid`,
            [data.documentVersionId, documentId],
          );
          if (version.rowCount !== 1)
            throw new BadRequestException('documentVersionId does not belong to this document');
        }

        await client.query(
          `INSERT INTO document_validations (
             tenant_id,document_id,document_version_id,validation_type,result,notes,provider_reference,details,
             validated_by_user_id
           ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::jsonb,$9::uuid)`,
          [
            context.tenantId,
            documentId,
            data.documentVersionId,
            data.validationType,
            data.result,
            data.notes,
            data.providerReference,
            JSON.stringify(data.details),
            context.userId,
          ],
        );

        const nextStatus =
          data.result === 'valid'
            ? this.expiryAwareStatus(document.expires_on, 'valid')
            : data.result === 'invalid'
              ? 'rejected'
              : 'pending';
        await client.query(
          `UPDATE documents SET status=$1,updated_by_user_id=$2::uuid,updated_at=now()
            WHERE id=$3::uuid AND deleted_at IS NULL`,
          [nextStatus, context.userId, documentId],
        );
        return this.requireDocumentRecord(client, documentId);
      }),
    );
  }

  linkBusinessParty(id: string, partyId: string, input: unknown): Promise<DocumentRecord> {
    const documentId = requireUuid(id, 'documentId');
    const party = requireUuid(partyId, 'businessPartyId');
    const data = parsePartyLink(input);
    return this.linkTyped(documentId, 'party', async (client, context, document) => {
      await this.requireTenantEntity(client, 'business_parties', party, 'business party');
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO business_party_documents (
           tenant_id,business_party_id,document_id,relation_type,created_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid)
         RETURNING id::text AS id`,
        [context.tenantId, party, document.id, data.relationType, context.userId],
      );
      return this.fetchLink(client, 'business_party_documents', inserted.rows[0]!.id);
    });
  }

  linkTransportRequest(id: string, requestId: string, input: unknown): Promise<DocumentRecord> {
    const documentId = requireUuid(id, 'documentId');
    const request = requireUuid(requestId, 'transportRequestId');
    const data = parseTransportRequestLink(input);
    return this.linkTyped(documentId, 'request', async (client, context, document) => {
      await this.requireTenantEntity(client, 'transport_requests', request, 'transport request');
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO transport_request_documents (
           tenant_id,transport_request_id,document_id,relation_type,created_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid)
         RETURNING id::text AS id`,
        [context.tenantId, request, document.id, data.relationType, context.userId],
      );
      return this.fetchLink(client, 'transport_request_documents', inserted.rows[0]!.id);
    });
  }

  linkDriver(id: string, driverId: string): Promise<DocumentRecord> {
    const documentId = requireUuid(id, 'documentId');
    const driver = requireUuid(driverId, 'driverId');
    return this.linkTyped(documentId, 'driver', async (client, context, document) => {
      await this.requireTenantEntity(client, 'drivers', driver, 'driver');
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO driver_documents (
           tenant_id,driver_id,document_id,document_type_id,issued_on,expires_on,status,validation_status,
           created_by_user_id,updated_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::date,$6::date,$7,$8,$9::uuid,$9::uuid)
         RETURNING id::text AS id`,
        [
          context.tenantId,
          driver,
          document.id,
          document.document_type_id,
          document.issued_on,
          document.expires_on,
          this.registerStatus(document.effective_status),
          this.registerValidationStatus(document),
          context.userId,
        ],
      );
      return this.fetchLink(client, 'driver_documents', inserted.rows[0]!.id);
    });
  }

  linkAsset(id: string, assetId: string): Promise<DocumentRecord> {
    const documentId = requireUuid(id, 'documentId');
    const asset = requireUuid(assetId, 'assetId');
    return this.linkTyped(documentId, 'asset', async (client, context, document) => {
      await this.requireTenantEntity(client, 'capacity_assets', asset, 'capacity asset');
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO capacity_asset_documents (
           tenant_id,asset_id,document_id,document_type_id,issued_on,expires_on,status,validation_status,
           created_by_user_id,updated_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::date,$6::date,$7,$8,$9::uuid,$9::uuid)
         RETURNING id::text AS id`,
        [
          context.tenantId,
          asset,
          document.id,
          document.document_type_id,
          document.issued_on,
          document.expires_on,
          this.registerStatus(document.effective_status),
          this.registerValidationStatus(document),
          context.userId,
        ],
      );
      return this.fetchLink(client, 'capacity_asset_documents', inserted.rows[0]!.id);
    });
  }

  private async linkTyped(
    documentId: string,
    scope: 'party' | 'request' | 'driver' | 'asset',
    work: (
      client: TenantQueryClient,
      context: { tenantId: string; userId: string },
      document: DocumentState,
    ) => Promise<DocumentRecord>,
  ): Promise<DocumentRecord> {
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        const document = await this.requireDocumentState(client, documentId, true);
        if (document.subject_scope !== scope && document.subject_scope !== 'other')
          throw new BadRequestException(
            `document type scope ${document.subject_scope} is not compatible with ${scope}`,
          );
        return work(client, context, document);
      }),
    );
  }

  private async requireDocumentRecord(
    client: TenantQueryClient,
    id: string,
  ): Promise<DocumentRecord> {
    const result = await client.query<DocumentRecord>(`${documentSelect}
      WHERE d.id=$1::uuid AND d.deleted_at IS NULL`, [id]);
    if (!result.rows[0]) throw new NotFoundException('document not found');
    return result.rows[0];
  }

  private async requireDocumentState(
    client: TenantQueryClient,
    id: string,
    lock = false,
  ): Promise<DocumentState> {
    const result = await client.query<DocumentState>(
      `SELECT d.id::text AS id,d.document_type_id::text AS document_type_id,dt.subject_scope,
              dt.has_expiry,dt.requires_validation,d.title,d.status,
              d.issued_on::text AS issued_on,d.expires_on::text AS expires_on,d.deleted_at,
              CASE WHEN d.expires_on IS NOT NULL AND d.expires_on < current_date THEN 'expired' ELSE d.status END AS effective_status
         FROM documents d
         JOIN document_types dt ON dt.tenant_id=d.tenant_id AND dt.id=d.document_type_id
        WHERE d.id=$1::uuid AND d.deleted_at IS NULL
        ${lock ? 'FOR UPDATE OF d' : ''}`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('document not found');
    return result.rows[0];
  }

  private async requireDocumentType(
    client: TenantQueryClient,
    id: string,
  ): Promise<{ has_expiry: boolean; requires_validation: boolean; subject_scope: string }> {
    const result = await client.query<{
      has_expiry: boolean;
      requires_validation: boolean;
      subject_scope: string;
    }>(
      `SELECT has_expiry,requires_validation,subject_scope
         FROM document_types
        WHERE id=$1::uuid AND is_active=true`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('document type not found');
    return result.rows[0];
  }

  private async requireTenantEntity(
    client: TenantQueryClient,
    table: 'business_parties' | 'transport_requests' | 'drivers' | 'capacity_assets',
    id: string,
    label: string,
  ): Promise<void> {
    const result = await client.query(`SELECT 1 FROM ${table} WHERE id=$1::uuid LIMIT 1`, [id]);
    if (result.rowCount !== 1) throw new NotFoundException(`${label} not found`);
  }

  private async fetchLink(
    client: TenantQueryClient,
    table:
      | 'business_party_documents'
      | 'transport_request_documents'
      | 'driver_documents'
      | 'capacity_asset_documents',
    id: string,
  ): Promise<DocumentRecord> {
    const result = await client.query<DocumentRecord>(`SELECT * FROM ${table} WHERE id=$1::uuid`, [id]);
    if (!result.rows[0]) throw new NotFoundException('document link not found');
    return result.rows[0];
  }

  private async scalar<T>(client: TenantQueryClient, column: string, id: string): Promise<T> {
    const allowed = new Set(['external_reference', 'notes', 'metadata']);
    if (!allowed.has(column)) throw new Error('unsupported document column');
    const result = await client.query<{ value: T }>(
      `SELECT ${column} AS value FROM documents WHERE id=$1::uuid AND deleted_at IS NULL`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('document not found');
    return result.rows[0].value;
  }

  private validateDates(issuedOn: string | null, expiresOn: string | null): void {
    if (issuedOn && expiresOn && Date.parse(expiresOn) < Date.parse(issuedOn))
      throw new BadRequestException('document validity end must be on or after start');
  }

  private expiryAwareStatus(expiresOn: string | null, otherwise: string): string {
    return expiresOn && Date.parse(expiresOn) < Date.now() ? 'expired' : otherwise;
  }

  private registerStatus(status: string): string {
    if (status === 'valid') return 'valid';
    if (status === 'expired') return 'expired';
    if (status === 'rejected') return 'blocked';
    if (status === 'archived') return 'inactive';
    return 'pending';
  }

  private registerValidationStatus(document: DocumentState): string {
    if (!document.requires_validation) return 'not_required';
    if (document.effective_status === 'valid' || document.effective_status === 'expired')
      return 'validated';
    if (document.effective_status === 'rejected') return 'rejected';
    return 'pending';
  }

  private async wrap<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      )
        throw error;
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === '23505') throw new ConflictException('document or link already exists');
      if (code === '23503')
        throw new BadRequestException('referenced entity does not exist in this tenant');
      if (code === '23514' || code === '22P02')
        throw new BadRequestException('document data violates a database constraint');
      throw error;
    }
  }
}

const documentSelect = `SELECT
  d.id::text AS id,
  d.document_type_id::text AS document_type_id,
  dt.code AS document_type_code,
  dt.name AS document_type_name,
  dt.subject_scope,
  dt.has_expiry,
  dt.requires_validation,
  d.title,
  d.status,
  CASE WHEN d.expires_on IS NOT NULL AND d.expires_on < current_date THEN 'expired' ELSE d.status END AS effective_status,
  d.issued_on,
  d.expires_on,
  d.external_reference,
  d.notes,
  d.metadata,
  d.created_by_user_id::text AS created_by_user_id,
  d.updated_by_user_id::text AS updated_by_user_id,
  d.deleted_at,
  d.deleted_by_user_id::text AS deleted_by_user_id,
  d.delete_reason,
  d.created_at,
  d.updated_at
FROM documents d
JOIN document_types dt ON dt.tenant_id=d.tenant_id AND dt.id=d.document_type_id`;
