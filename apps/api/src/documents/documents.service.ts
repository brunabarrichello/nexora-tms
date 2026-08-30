import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  parseDocumentCreate,
  parseDocumentLink,
  parseDocumentListQuery,
  parseDocumentValidation,
  parseDocumentVersion,
  parseUnlink,
  requireUuid,
  type DocumentTargetKind,
} from './document.validation.js';

export type DocumentRecord = Readonly<Record<string, unknown>>;
export interface DocumentPage {
  readonly items: readonly DocumentRecord[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

type DocumentAggregate = {
  readonly id: string;
  readonly status: string;
  readonly validation_status: string;
  readonly current_version_number: number;
  readonly is_blocking: boolean;
  readonly subject_scope: string;
  readonly has_expiry: boolean;
  readonly requires_validation: boolean;
};

type DocumentTypeRow = {
  readonly id: string;
  readonly subject_scope: string;
  readonly has_expiry: boolean;
  readonly requires_validation: boolean;
};

type LinkTarget = {
  readonly table: string;
  readonly column: string;
  readonly scope: string;
};

const linkTargets: Readonly<Record<DocumentTargetKind, LinkTarget>> = {
  party: { table: 'business_parties', column: 'party_id', scope: 'party' },
  driver: { table: 'drivers', column: 'driver_id', scope: 'driver' },
  driver_document: { table: 'driver_documents', column: 'driver_document_id', scope: 'driver' },
  asset: { table: 'capacity_assets', column: 'asset_id', scope: 'asset' },
  asset_document: {
    table: 'capacity_asset_documents',
    column: 'asset_document_id',
    scope: 'asset',
  },
  request: { table: 'transport_requests', column: 'transport_request_id', scope: 'request' },
  contract: { table: 'transport_contracts', column: 'transport_contract_id', scope: 'contract' },
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  list(input: Record<string, unknown>): Promise<DocumentPage> {
    const query = parseDocumentListQuery(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const values: unknown[] = [];
      const filters: string[] = [];
      const parameter = (value: unknown): string => {
        values.push(value);
        return `$${values.length}`;
      };

      if (query.q) {
        const p = parameter(`%${query.q}%`);
        filters.push(
          `(d.title ILIKE ${p} OR coalesce(d.document_number,'') ILIKE ${p} OR dt.name ILIKE ${p})`,
        );
      }
      if (query.status) filters.push(`d.status = ${parameter(query.status)}`);
      if (query.validationStatus) {
        filters.push(`d.validation_status = ${parameter(query.validationStatus)}`);
      }
      if (query.documentTypeId) {
        filters.push(`d.document_type_id = ${parameter(query.documentTypeId)}::uuid`);
      }
      if (query.expiringBefore) {
        filters.push(
          `d.expires_on IS NOT NULL AND d.expires_on <= ${parameter(query.expiringBefore)}::date`,
        );
      }
      const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
      const count = await client.query<{ total: number }>(
        `SELECT count(*)::int AS total
           FROM documents d
           JOIN document_types dt ON dt.tenant_id=d.tenant_id AND dt.id=d.document_type_id
         ${where}`,
        values,
      );
      const itemValues = [...values, query.limit, query.offset];
      const limitParam = `$${itemValues.length - 1}`;
      const offsetParam = `$${itemValues.length}`;
      const items = await client.query<DocumentRecord>(
        `SELECT d.*,
                dt.code AS document_type_code,
                dt.name AS document_type_name,
                dt.subject_scope,
                dt.has_expiry,
                dt.requires_validation,
                CASE
                  WHEN d.status NOT IN ('archived','blocked') AND d.expires_on IS NOT NULL AND d.expires_on < current_date
                    THEN 'expired'
                  ELSE d.status
                END AS effective_status
           FROM documents d
           JOIN document_types dt ON dt.tenant_id=d.tenant_id AND dt.id=d.document_type_id
         ${where}
          ORDER BY coalesce(d.expires_on, DATE '9999-12-31'), d.created_at DESC
          LIMIT ${limitParam} OFFSET ${offsetParam}`,
        itemValues,
      );
      return {
        items: items.rows,
        total: count.rows[0]?.total ?? 0,
        limit: query.limit,
        offset: query.offset,
      };
    });
  }

  create(input: unknown): Promise<DocumentRecord> {
    const data = parseDocumentCreate(input);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        const type = await this.requireDocumentType(client, data.documentTypeId);
        if (!type.has_expiry && data.expiresOn) {
          throw new BadRequestException('this document type does not allow an expiry date');
        }
        const validationStatus = type.requires_validation ? 'pending' : 'not_required';
        const result = await client.query<{ id: string }>(
          `INSERT INTO documents (
             tenant_id,document_type_id,title,document_number,issuer,issued_on,expires_on,status,
             validation_status,current_version_number,is_blocking,notes,created_by_user_id,updated_by_user_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,0,$9,$10,$11,$11)
           RETURNING id::text AS id`,
          [
            context.tenantId,
            data.documentTypeId,
            data.title,
            data.documentNumber,
            data.issuer,
            data.issuedOn,
            data.expiresOn,
            validationStatus,
            data.isBlocking,
            data.notes,
            context.userId,
          ],
        );
        return this.fetchDocument(client, result.rows[0]!.id);
      }),
    );
  }

  get(documentId: string): Promise<DocumentRecord> {
    const id = requireUuid(documentId, 'documentId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, (client) => this.fetchDocument(client, id));
  }

  listVersions(documentId: string): Promise<readonly DocumentRecord[]> {
    const id = requireUuid(documentId, 'documentId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireDocument(client, id);
      const result = await client.query<DocumentRecord>(
        `SELECT * FROM document_versions WHERE document_id=$1::uuid ORDER BY version_number DESC`,
        [id],
      );
      return result.rows;
    });
  }

  createVersion(documentId: string, input: unknown): Promise<DocumentRecord> {
    const id = requireUuid(documentId, 'documentId');
    const data = parseDocumentVersion(input);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        const document = await this.requireDocument(client, id, true);
        this.requireMutableDocument(document);
        const versionNumber = document.current_version_number + 1;
        const result = await client.query<{ id: string }>(
          `INSERT INTO document_versions (
             tenant_id,document_id,version_number,storage_provider,storage_key,file_name,mime_type,size_bytes,
             sha256,source,metadata,uploaded_by_user_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
           RETURNING id::text AS id`,
          [
            context.tenantId,
            id,
            versionNumber,
            data.storageProvider,
            data.storageKey,
            data.fileName,
            data.mimeType,
            data.sizeBytes,
            data.sha256,
            data.source,
            JSON.stringify(data.metadata),
            context.userId,
          ],
        );
        await client.query(
          `UPDATE documents
              SET current_version_number=$1,
                  status=CASE WHEN $2::boolean THEN status WHEN status='draft' THEN 'active' ELSE status END,
                  validation_status=CASE WHEN $2::boolean THEN validation_status ELSE 'not_required' END,
                  updated_by_user_id=$3::uuid,
                  updated_at=now()
            WHERE id=$4::uuid`,
          [versionNumber, document.requires_validation, context.userId, id],
        );
        return this.fetchById(client, 'document_versions', result.rows[0]!.id);
      }),
    );
  }

  listValidations(documentId: string): Promise<readonly DocumentRecord[]> {
    const id = requireUuid(documentId, 'documentId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireDocument(client, id);
      const result = await client.query<DocumentRecord>(
        `SELECT * FROM document_validations WHERE document_id=$1::uuid ORDER BY created_at DESC`,
        [id],
      );
      return result.rows;
    });
  }

  createValidation(documentId: string, input: unknown): Promise<DocumentRecord> {
    const id = requireUuid(documentId, 'documentId');
    const data = parseDocumentValidation(input);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        const document = await this.requireDocument(client, id, true);
        this.requireMutableDocument(document);
        if (data.versionId) await this.requireVersion(client, id, data.versionId);
        const completed = data.status !== 'pending';
        const result = await client.query<{ id: string }>(
          `INSERT INTO document_validations (
             tenant_id,document_id,version_id,validation_type,status,validator_user_id,validated_at,
             provider,rule_code,details,notes,created_by_user_id
           ) VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $7::boolean THEN now() ELSE NULL END,$8,$9,$10::jsonb,$11,$12)
           RETURNING id::text AS id`,
          [
            context.tenantId,
            id,
            data.versionId,
            data.validationType,
            data.status,
            completed ? context.userId : null,
            completed,
            data.provider,
            data.ruleCode,
            JSON.stringify(data.details),
            data.notes,
            context.userId,
          ],
        );
        const aggregate = validationAggregate(document, data.status);
        await client.query(
          `UPDATE documents
              SET status=$1,validation_status=$2,updated_by_user_id=$3::uuid,updated_at=now()
            WHERE id=$4::uuid`,
          [aggregate.status, aggregate.validationStatus, context.userId, id],
        );
        return this.fetchById(client, 'document_validations', result.rows[0]!.id);
      }),
    );
  }

  listLinks(documentId: string): Promise<readonly DocumentRecord[]> {
    const id = requireUuid(documentId, 'documentId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireDocument(client, id);
      const result = await client.query<DocumentRecord>(
        `SELECT *,
                coalesce(party_id,driver_id,driver_document_id,asset_id,asset_document_id,
                         transport_request_id,transport_contract_id)::text AS target_id
           FROM document_links
          WHERE document_id=$1::uuid
          ORDER BY unlinked_at NULLS FIRST, created_at DESC`,
        [id],
      );
      return result.rows;
    });
  }

  createLink(documentId: string, input: unknown): Promise<DocumentRecord> {
    const id = requireUuid(documentId, 'documentId');
    const data = parseDocumentLink(input);
    const context = this.tenantContext.require();
    const target = linkTargets[data.targetKind];
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        const document = await this.requireDocument(client, id);
        this.requireMutableDocument(document);
        if (document.subject_scope !== 'other' && document.subject_scope !== target.scope) {
          throw new BadRequestException(
            `document type scope ${document.subject_scope} is not compatible with ${data.targetKind}`,
          );
        }
        await this.requireTarget(client, target, data.targetId);
        const result = await client.query<{ id: string }>(
          `INSERT INTO document_links (
             tenant_id,document_id,target_kind,relation_type,${target.column},created_by_user_id
           ) VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING id::text AS id`,
          [context.tenantId, id, data.targetKind, data.relationType, data.targetId, context.userId],
        );
        return this.fetchLink(client, result.rows[0]!.id);
      }),
    );
  }

  unlink(documentId: string, linkId: string, input: unknown): Promise<DocumentRecord> {
    const document = requireUuid(documentId, 'documentId');
    const link = requireUuid(linkId, 'linkId');
    const data = parseUnlink(input);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        await this.requireDocument(client, document);
        const result = await client.query<{ id: string }>(
          `UPDATE document_links
              SET unlinked_at=now(),unlinked_by_user_id=$1::uuid,unlink_reason=$2
            WHERE id=$3::uuid AND document_id=$4::uuid AND unlinked_at IS NULL
            RETURNING id::text AS id`,
          [context.userId, data.reason, link, document],
        );
        if (!result.rows[0]) throw new NotFoundException('active document link not found');
        return this.fetchLink(client, result.rows[0].id);
      }),
    );
  }

  private async fetchDocument(client: TenantQueryClient, id: string): Promise<DocumentRecord> {
    const result = await client.query<DocumentRecord>(
      `SELECT d.*,
              dt.code AS document_type_code,
              dt.name AS document_type_name,
              dt.subject_scope,
              dt.has_expiry,
              dt.requires_validation,
              CASE
                WHEN d.status NOT IN ('archived','blocked') AND d.expires_on IS NOT NULL AND d.expires_on < current_date
                  THEN 'expired'
                ELSE d.status
              END AS effective_status,
              (SELECT count(*)::int FROM document_versions v WHERE v.document_id=d.id) AS version_count,
              (SELECT count(*)::int FROM document_validations v WHERE v.document_id=d.id) AS validation_count,
              (SELECT count(*)::int FROM document_links l WHERE l.document_id=d.id AND l.unlinked_at IS NULL) AS active_link_count
         FROM documents d
         JOIN document_types dt ON dt.tenant_id=d.tenant_id AND dt.id=d.document_type_id
        WHERE d.id=$1::uuid`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('document not found');
    return result.rows[0];
  }

  private async requireDocument(
    client: TenantQueryClient,
    id: string,
    lock = false,
  ): Promise<DocumentAggregate> {
    const result = await client.query<DocumentAggregate>(
      `SELECT d.id,d.status,d.validation_status,d.current_version_number,d.is_blocking,
              dt.subject_scope,dt.has_expiry,dt.requires_validation
         FROM documents d
         JOIN document_types dt ON dt.tenant_id=d.tenant_id AND dt.id=d.document_type_id
        WHERE d.id=$1::uuid${lock ? ' FOR UPDATE OF d' : ''}`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('document not found');
    return result.rows[0];
  }

  private async requireDocumentType(
    client: TenantQueryClient,
    id: string,
  ): Promise<DocumentTypeRow> {
    const result = await client.query<DocumentTypeRow>(
      `SELECT id::text AS id,subject_scope,has_expiry,requires_validation
         FROM document_types WHERE id=$1::uuid AND is_active=true`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('document type not found');
    return result.rows[0];
  }

  private async requireVersion(
    client: TenantQueryClient,
    documentId: string,
    versionId: string,
  ): Promise<void> {
    const result = await client.query(
      `SELECT 1 FROM document_versions WHERE id=$1::uuid AND document_id=$2::uuid`,
      [versionId, documentId],
    );
    if (result.rowCount !== 1) throw new NotFoundException('document version not found');
  }

  private async requireTarget(
    client: TenantQueryClient,
    target: LinkTarget,
    targetId: string,
  ): Promise<void> {
    const result = await client.query(`SELECT 1 FROM ${target.table} WHERE id=$1::uuid LIMIT 1`, [
      targetId,
    ]);
    if (result.rowCount !== 1) throw new NotFoundException('document link target not found');
  }

  private requireMutableDocument(document: DocumentAggregate): void {
    if (document.status === 'archived')
      throw new ConflictException('archived document is immutable');
  }

  private async fetchById(
    client: TenantQueryClient,
    table: 'document_versions' | 'document_validations',
    id: string,
  ): Promise<DocumentRecord> {
    const result = await client.query<DocumentRecord>(`SELECT * FROM ${table} WHERE id=$1::uuid`, [
      id,
    ]);
    if (!result.rows[0]) throw new NotFoundException('document child record not found');
    return result.rows[0];
  }

  private async fetchLink(client: TenantQueryClient, id: string): Promise<DocumentRecord> {
    const result = await client.query<DocumentRecord>(
      `SELECT *,
              coalesce(party_id,driver_id,driver_document_id,asset_id,asset_document_id,
                       transport_request_id,transport_contract_id)::text AS target_id
         FROM document_links WHERE id=$1::uuid`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('document link not found');
    return result.rows[0];
  }

  private async wrap<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === '23505')
        throw new ConflictException('document record conflicts with existing data');
      if (code === '23503') {
        throw new BadRequestException('referenced document entity does not exist in this tenant');
      }
      if (code === '23514' || code === '22P02') {
        throw new BadRequestException('document data violates a database constraint');
      }
      throw error;
    }
  }
}

function validationAggregate(
  document: DocumentAggregate,
  validationStatus: string,
): { readonly status: string; readonly validationStatus: string } {
  switch (validationStatus) {
    case 'validated':
      return { status: 'active', validationStatus: 'validated' };
    case 'rejected':
      return {
        status: document.is_blocking ? 'blocked' : 'draft',
        validationStatus: 'rejected',
      };
    case 'not_applicable':
      return { status: 'active', validationStatus: 'not_required' };
    case 'warning':
    case 'pending':
    default:
      return {
        status: document.status === 'blocked' ? 'blocked' : 'draft',
        validationStatus: 'pending',
      };
  }
}
