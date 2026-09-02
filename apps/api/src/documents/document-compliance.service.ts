import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  parseComplianceContext,
  parseComplianceOverride,
  parseCompliancePolicy,
  parseComplianceSubjectScope,
  type DocumentComplianceSubjectScope,
} from './document-compliance.validation.js';
import { requireUuid } from './documents.validation.js';

export type DocumentComplianceRecord = Readonly<Record<string, unknown>>;

@Injectable()
export class DocumentComplianceService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  listPolicies(): Promise<readonly DocumentComplianceRecord[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<DocumentComplianceRecord>(
        `SELECT p.id::text AS id,
                p.document_type_id::text AS "documentTypeId",
                dt.code AS "documentTypeCode",dt.name AS "documentTypeName",
                dt.subject_scope AS "subjectScope",
                p.required_for_contracting AS "requiredForContracting",
                p.required_for_trip AS "requiredForTrip",
                p.warning_days AS "warningDays",
                p.block_when_expiring_soon AS "blockWhenExpiringSoon",
                p.block_when_pending AS "blockWhenPending",
                p.block_when_rejected AS "blockWhenRejected",
                p.block_when_expired AS "blockWhenExpired",
                p.is_active AS "isActive",
                p.created_by_user_id::text AS "createdByUserId",
                p.updated_by_user_id::text AS "updatedByUserId",
                p.created_at AS "createdAt",p.updated_at AS "updatedAt"
           FROM document_compliance_policies p
           JOIN document_types dt ON dt.tenant_id=p.tenant_id AND dt.id=p.document_type_id
          ORDER BY dt.subject_scope,dt.name,p.id`,
      );
      return result.rows;
    });
  }

  async upsertPolicy(input: unknown): Promise<DocumentComplianceRecord> {
    const policy = parseCompliancePolicy(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const type = await client.query<{ subject_scope: string }>(
        `SELECT subject_scope FROM document_types WHERE id=$1::uuid AND is_active=true`,
        [policy.documentTypeId],
      );
      const subjectScope = type.rows[0]?.subject_scope;
      if (!subjectScope) {
        throw new NotFoundException('document type not found in current tenant');
      }
      if (!['party', 'driver', 'asset'].includes(subjectScope)) {
        throw new ConflictException(
          'blocking compliance policy only supports party, driver or asset document types',
        );
      }

      const result = await client.query<{ id: string }>(
        `INSERT INTO document_compliance_policies (
           tenant_id,document_type_id,required_for_contracting,required_for_trip,warning_days,
           block_when_expiring_soon,block_when_pending,block_when_rejected,block_when_expired,
           is_active,created_by_user_id,updated_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid,$11::uuid)
         ON CONFLICT (tenant_id,document_type_id) DO UPDATE SET
           required_for_contracting=excluded.required_for_contracting,
           required_for_trip=excluded.required_for_trip,
           warning_days=excluded.warning_days,
           block_when_expiring_soon=excluded.block_when_expiring_soon,
           block_when_pending=excluded.block_when_pending,
           block_when_rejected=excluded.block_when_rejected,
           block_when_expired=excluded.block_when_expired,
           is_active=excluded.is_active,
           updated_by_user_id=excluded.updated_by_user_id,
           updated_at=now()
         RETURNING id::text AS id`,
        [
          context.tenantId,
          policy.documentTypeId,
          policy.requiredForContracting,
          policy.requiredForTrip,
          policy.warningDays,
          policy.blockWhenExpiringSoon,
          policy.blockWhenPending,
          policy.blockWhenRejected,
          policy.blockWhenExpired,
          policy.isActive,
          context.userId,
        ],
      );
      const id = result.rows[0]?.id;
      if (!id) {
        throw new ConflictException('document compliance policy could not be persisted');
      }
      return this.requirePolicy(client, id);
    });
  }

  listOverrides(): Promise<readonly DocumentComplianceRecord[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<DocumentComplianceRecord>(
        `SELECT o.id::text AS id,o.context,o.subject_scope AS "subjectScope",
                o.subject_id::text AS "subjectId",o.document_type_id::text AS "documentTypeId",
                dt.code AS "documentTypeCode",dt.name AS "documentTypeName",
                o.reason,o.valid_until AS "validUntil",(o.valid_until > clock_timestamp()) AS active,
                o.created_by_user_id::text AS "createdByUserId",o.created_at AS "createdAt"
           FROM document_compliance_overrides o
           JOIN document_types dt ON dt.tenant_id=o.tenant_id AND dt.id=o.document_type_id
          ORDER BY o.created_at DESC,o.id
          LIMIT 200`,
      );
      return result.rows;
    });
  }

  async createOverride(input: unknown): Promise<DocumentComplianceRecord> {
    const override = parseComplianceOverride(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireSubject(client, override.subjectScope, override.subjectId);
      const policy = await client.query<{
        subject_scope: string;
        enabled: boolean;
      }>(
        `SELECT dt.subject_scope,
                (CASE WHEN $2::text='contracting' THEN p.required_for_contracting ELSE p.required_for_trip END) AS enabled
           FROM document_compliance_policies p
           JOIN document_types dt ON dt.tenant_id=p.tenant_id AND dt.id=p.document_type_id
          WHERE p.document_type_id=$1::uuid AND p.is_active=true`,
        [override.documentTypeId, override.context],
      );
      const row = policy.rows[0];
      if (!row) {
        throw new NotFoundException('active compliance policy not found for document type');
      }
      if (row.subject_scope !== override.subjectScope) {
        throw new ConflictException('document type policy does not match override subject scope');
      }
      if (!row.enabled) {
        throw new ConflictException('document type policy is not enabled for requested context');
      }

      const result = await client.query<DocumentComplianceRecord>(
        `INSERT INTO document_compliance_overrides (
           tenant_id,context,subject_scope,subject_id,document_type_id,reason,valid_until,created_by_user_id
         ) VALUES ($1::uuid,$2,$3,$4::uuid,$5::uuid,$6,$7::timestamptz,$8::uuid)
         RETURNING id::text AS id,context,subject_scope AS "subjectScope",subject_id::text AS "subjectId",
                   document_type_id::text AS "documentTypeId",reason,valid_until AS "validUntil",
                   created_by_user_id::text AS "createdByUserId",created_at AS "createdAt"`,
        [
          context.tenantId,
          override.context,
          override.subjectScope,
          override.subjectId,
          override.documentTypeId,
          override.reason,
          override.validUntil,
          context.userId,
        ],
      );
      const created = result.rows[0];
      if (!created) {
        throw new ConflictException('document compliance override could not be persisted');
      }
      return created;
    });
  }

  async evaluate(
    subjectScopeValue: string,
    subjectIdValue: string,
    contextValue: string,
  ): Promise<readonly DocumentComplianceRecord[]> {
    const subjectScope = parseComplianceSubjectScope(subjectScopeValue);
    const subjectId = requireUuid(subjectIdValue, 'subjectId');
    const complianceContext = parseComplianceContext(contextValue);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireSubject(client, subjectScope, subjectId);
      const result = await client.query<DocumentComplianceRecord>(
        `SELECT document_type_id::text AS "documentTypeId",
                document_type_code AS "documentTypeCode",document_type_name AS "documentTypeName",
                state,blocking,expires_on AS "expiresOn",warning_days AS "warningDays",
                override_id::text AS "overrideId",reason
           FROM nexora_evaluate_document_compliance($1,$2::uuid,$3)`,
        [subjectScope, subjectId, complianceContext],
      );
      return result.rows;
    });
  }

  private async requirePolicy(
    client: TenantQueryClient,
    id: string,
  ): Promise<DocumentComplianceRecord> {
    const result = await client.query<DocumentComplianceRecord>(
      `SELECT p.id::text AS id,p.document_type_id::text AS "documentTypeId",
              dt.code AS "documentTypeCode",dt.name AS "documentTypeName",dt.subject_scope AS "subjectScope",
              p.required_for_contracting AS "requiredForContracting",p.required_for_trip AS "requiredForTrip",
              p.warning_days AS "warningDays",p.block_when_expiring_soon AS "blockWhenExpiringSoon",
              p.block_when_pending AS "blockWhenPending",p.block_when_rejected AS "blockWhenRejected",
              p.block_when_expired AS "blockWhenExpired",p.is_active AS "isActive",
              p.created_by_user_id::text AS "createdByUserId",p.updated_by_user_id::text AS "updatedByUserId",
              p.created_at AS "createdAt",p.updated_at AS "updatedAt"
         FROM document_compliance_policies p
         JOIN document_types dt ON dt.tenant_id=p.tenant_id AND dt.id=p.document_type_id
        WHERE p.id=$1::uuid`,
      [id],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('document compliance policy not found');
    }
    return result.rows[0];
  }

  private async requireSubject(
    client: TenantQueryClient,
    scope: DocumentComplianceSubjectScope,
    id: string,
  ): Promise<void> {
    const table: Record<DocumentComplianceSubjectScope, string> = {
      party: 'business_parties',
      driver: 'drivers',
      asset: 'capacity_assets',
    };
    const result = await client.query(`SELECT 1 FROM ${table[scope]} WHERE id=$1::uuid LIMIT 1`, [
      id,
    ]);
    if (result.rowCount !== 1) {
      throw new NotFoundException(`${scope} not found in current tenant`);
    }
  }
}
