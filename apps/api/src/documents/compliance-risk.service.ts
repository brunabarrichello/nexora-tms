import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService, type TenantQueryClient } from '../tenancy/tenant-database.service.js';
import {
  COMPLIANCE_RISK_PROVIDER_PORT,
  type ComplianceRiskProviderPort,
  type ComplianceRiskSeverity,
  type ComplianceRiskSignal,
  type ComplianceRiskSubjectScope,
} from './compliance-risk-provider.port.js';
import {
  parseComplianceRiskDecision,
  parseComplianceRiskSubjectScope,
  type ComplianceRiskDecision,
} from './compliance-risk.validation.js';
import { requireUuid } from './documents.validation.js';

export type ComplianceRiskRecord = Readonly<Record<string, unknown>>;

const RULES_VERSION = 'nex49-v1';

@Injectable()
export class ComplianceRiskService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
    @Inject(COMPLIANCE_RISK_PROVIDER_PORT)
    private readonly provider: ComplianceRiskProviderPort,
  ) {}

  async list(
    subjectScopeValue: string,
    subjectIdValue: string,
  ): Promise<readonly ComplianceRiskRecord[]> {
    const subjectScope = parseComplianceRiskSubjectScope(subjectScopeValue);
    const subjectId = requireUuid(subjectIdValue, 'subjectId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.loadSubjectSnapshot(client, subjectScope, subjectId);
      const result = await client.query<ComplianceRiskRecord>(
        `${assessmentSelect()}
          WHERE subject_scope=$1 AND subject_id=$2::uuid
          ORDER BY assessed_at DESC,id DESC
          LIMIT 100`,
        [subjectScope, subjectId],
      );
      return result.rows;
    });
  }

  async evaluate(
    subjectScopeValue: string,
    subjectIdValue: string,
  ): Promise<ComplianceRiskRecord> {
    const subjectScope = parseComplianceRiskSubjectScope(subjectScopeValue);
    const subjectId = requireUuid(subjectIdValue, 'subjectId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const snapshot = await this.loadSubjectSnapshot(client, subjectScope, subjectId);
      const signals = this.evaluateInternalSignals(subjectScope, snapshot);
      if (subjectScope !== 'document') {
        signals.push(...(await this.evaluateDocumentCompliance(client, subjectScope, subjectId)));
      }

      const providerResult = await this.provider.evaluate({
        tenantId: context.tenantId,
        subjectScope,
        subjectId,
        snapshot,
      });
      if (providerResult) {
        signals.push(...providerResult.signals.map(normalizeSignal));
      }

      const normalizedSignals = dedupeSignals(signals);
      const score = Math.min(
        100,
        normalizedSignals.reduce((sum, signal) => sum + clampScore(signal.scoreDelta), 0),
      );
      const decision = resolveDecision(normalizedSignals, score);
      const reason = buildReason(decision, normalizedSignals);

      return this.insertAssessment(client, {
        subjectScope,
        subjectId,
        source: providerResult ? 'external' : 'system',
        decision,
        score,
        reason,
        signals: normalizedSignals,
        provider: providerResult?.provider ?? null,
        providerReference: providerResult?.reference ?? null,
        providerDetails: providerResult?.details ?? {},
        supersedesAssessmentId: null,
        assessedByUserId: context.userId,
      });
    });
  }

  async decide(assessmentIdValue: string, input: unknown): Promise<ComplianceRiskRecord> {
    const assessmentId = requireUuid(assessmentIdValue, 'assessmentId');
    const manual = parseComplianceRiskDecision(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const previous = await client.query<{
        subject_scope: ComplianceRiskSubjectScope;
        subject_id: string;
        score: number;
        signals: readonly ComplianceRiskSignal[];
        rules_version: string;
        provider: string | null;
        provider_reference: string | null;
        provider_details: Readonly<Record<string, unknown>>;
      }>(
        `SELECT subject_scope,subject_id::text AS subject_id,score,signals,rules_version,
                provider,provider_reference,provider_details
           FROM compliance_risk_assessments
          WHERE id=$1::uuid`,
        [assessmentId],
      );
      const row = previous.rows[0];
      if (!row) throw new NotFoundException('risk assessment not found in current tenant');

      return this.insertAssessment(client, {
        subjectScope: row.subject_scope,
        subjectId: row.subject_id,
        source: 'manual',
        decision: manual.decision,
        score: row.score,
        reason: manual.reason,
        signals: row.signals,
        provider: row.provider,
        providerReference: row.provider_reference,
        providerDetails: row.provider_details,
        supersedesAssessmentId: assessmentId,
        assessedByUserId: context.userId,
        rulesVersion: row.rules_version,
      });
    });
  }

  private async loadSubjectSnapshot(
    client: TenantQueryClient,
    scope: ComplianceRiskSubjectScope,
    subjectId: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    let result;
    if (scope === 'party') {
      result = await client.query<Record<string, unknown>>(
        `SELECT p.id::text AS id,p.status::text AS status,
                p.homologation_status::text AS homologation_status,
                (p.email IS NOT NULL) AS has_email,(p.phone IS NOT NULL) AS has_phone,
                coalesce(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL),'{}'::text[]) AS roles
           FROM business_parties p
           LEFT JOIN business_party_roles r ON r.tenant_id=p.tenant_id AND r.party_id=p.id
          WHERE p.id=$1::uuid
          GROUP BY p.id,p.status,p.homologation_status,p.email,p.phone`,
        [subjectId],
      );
    } else if (scope === 'driver') {
      result = await client.query<Record<string, unknown>>(
        `SELECT id::text AS id,registration_status::text AS registration_status,
                operational_status::text AS operational_status,
                (cnh_expires_on < current_date) AS cnh_expired,
                (email IS NOT NULL) AS has_email,(carrier_party_id IS NOT NULL) AS has_carrier
           FROM drivers WHERE id=$1::uuid`,
        [subjectId],
      );
    } else if (scope === 'asset') {
      result = await client.query<Record<string, unknown>>(
        `SELECT id::text AS id,status::text AS status,asset_kind::text AS asset_kind,
                tracking_available,(carrier_party_id IS NOT NULL) AS has_carrier,
                (owner_party_id IS NOT NULL OR owner_name IS NOT NULL) AS has_owner
           FROM capacity_assets WHERE id=$1::uuid`,
        [subjectId],
      );
    } else {
      result = await client.query<Record<string, unknown>>(
        `SELECT d.id::text AS id,d.status::text AS status,
                (d.expires_on IS NOT NULL AND d.expires_on < current_date) AS expired,
                latest.result::text AS latest_validation_result,
                latest.validation_type::text AS latest_validation_type
           FROM documents d
           LEFT JOIN LATERAL (
             SELECT v.result,v.validation_type
               FROM document_validations v
              WHERE v.document_id=d.id
              ORDER BY v.validated_at DESC,v.created_at DESC,v.id DESC
              LIMIT 1
           ) latest ON true
          WHERE d.id=$1::uuid AND d.deleted_at IS NULL`,
        [subjectId],
      );
    }

    const row = result.rows[0];
    if (!row) throw new NotFoundException(`${scope} not found in current tenant`);
    return row;
  }

  private evaluateInternalSignals(
    scope: ComplianceRiskSubjectScope,
    snapshot: Readonly<Record<string, unknown>>,
  ): ComplianceRiskSignal[] {
    if (scope === 'party') return partySignals(snapshot);
    if (scope === 'driver') return driverSignals(snapshot);
    if (scope === 'asset') return assetSignals(snapshot);
    return documentSignals(snapshot);
  }

  private async evaluateDocumentCompliance(
    client: TenantQueryClient,
    scope: Exclude<ComplianceRiskSubjectScope, 'document'>,
    subjectId: string,
  ): Promise<ComplianceRiskSignal[]> {
    const result = await client.query<{
      document_type_code: string;
      state: string;
      blocking: boolean;
      reason: string;
    }>(
      `SELECT document_type_code,state,blocking,reason
         FROM nexora_evaluate_document_compliance($1,$2::uuid,'contracting')`,
      [scope, subjectId],
    );

    return result.rows.flatMap((row): ComplianceRiskSignal[] => {
      const details = { documentTypeCode: row.document_type_code, state: row.state };
      if (row.blocking) {
        return [
          signal(
            `DOCUMENT_COMPLIANCE_BLOCK_${row.document_type_code}`,
            'critical',
            row.reason,
            80,
            details,
          ),
        ];
      }
      if (row.state === 'pending') {
        return [
          signal(
            `DOCUMENT_COMPLIANCE_PENDING_${row.document_type_code}`,
            'medium',
            row.reason,
            30,
            details,
          ),
        ];
      }
      if (row.state === 'expiring_soon') {
        return [
          signal(
            `DOCUMENT_COMPLIANCE_EXPIRING_${row.document_type_code}`,
            'low',
            row.reason,
            10,
            details,
          ),
        ];
      }
      if (row.state === 'expired' || row.state === 'rejected') {
        return [
          signal(
            `DOCUMENT_COMPLIANCE_${row.state.toUpperCase()}_${row.document_type_code}`,
            'high',
            row.reason,
            40,
            details,
          ),
        ];
      }
      return [];
    });
  }

  private async insertAssessment(
    client: TenantQueryClient,
    input: {
      readonly subjectScope: ComplianceRiskSubjectScope;
      readonly subjectId: string;
      readonly source: 'system' | 'manual' | 'external';
      readonly decision: ComplianceRiskDecision;
      readonly score: number;
      readonly reason: string;
      readonly signals: readonly ComplianceRiskSignal[];
      readonly provider: string | null;
      readonly providerReference: string | null;
      readonly providerDetails: Readonly<Record<string, unknown>>;
      readonly supersedesAssessmentId: string | null;
      readonly assessedByUserId: string;
      readonly rulesVersion?: string;
    },
  ): Promise<ComplianceRiskRecord> {
    const result = await client.query<ComplianceRiskRecord>(
      `INSERT INTO compliance_risk_assessments (
         tenant_id,subject_scope,subject_id,source,decision,score,reason,rules_version,signals,
         provider,provider_reference,provider_details,supersedes_assessment_id,assessed_by_user_id
       ) VALUES (
         nullif(current_setting('app.tenant_id',true),'')::uuid,$1,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,
         $9,$10,$11::jsonb,$12::uuid,$13::uuid
       )
       RETURNING id::text AS id,subject_scope AS "subjectScope",subject_id::text AS "subjectId",
                 source,decision,score,reason,rules_version AS "rulesVersion",signals,
                 provider,provider_reference AS "providerReference",provider_details AS "providerDetails",
                 supersedes_assessment_id::text AS "supersedesAssessmentId",
                 assessed_by_user_id::text AS "assessedByUserId",assessed_at AS "assessedAt",
                 created_at AS "createdAt"`,
      [
        input.subjectScope,
        input.subjectId,
        input.source,
        input.decision,
        input.score,
        input.reason,
        input.rulesVersion ?? RULES_VERSION,
        JSON.stringify(input.signals),
        input.provider,
        input.providerReference,
        JSON.stringify(input.providerDetails),
        input.supersedesAssessmentId,
        input.assessedByUserId,
      ],
    );
    const created = result.rows[0];
    if (!created) throw new ConflictException('risk assessment could not be persisted');
    return created;
  }
}

function assessmentSelect(): string {
  return `SELECT id::text AS id,subject_scope AS "subjectScope",subject_id::text AS "subjectId",
                 source,decision,score,reason,rules_version AS "rulesVersion",signals,
                 provider,provider_reference AS "providerReference",provider_details AS "providerDetails",
                 supersedes_assessment_id::text AS "supersedesAssessmentId",
                 assessed_by_user_id::text AS "assessedByUserId",assessed_at AS "assessedAt",
                 created_at AS "createdAt"
            FROM compliance_risk_assessments`;
}

function partySignals(snapshot: Readonly<Record<string, unknown>>): ComplianceRiskSignal[] {
  const signals: ComplianceRiskSignal[] = [];
  if (snapshot.status === 'inactive') {
    signals.push(signal('PARTY_INACTIVE', 'medium', 'Business party is inactive', 30));
  }
  const roles = Array.isArray(snapshot.roles) ? snapshot.roles.map(String) : [];
  const partnerScoped = roles.some((role) => ['carrier', 'partner', 'supplier'].includes(role));
  if (snapshot.homologation_status === 'rejected') {
    signals.push(signal('PARTY_HOMOLOGATION_REJECTED', 'critical', 'Business party homologation is rejected', 80));
  } else if (partnerScoped && snapshot.homologation_status !== 'approved') {
    signals.push(signal('PARTY_HOMOLOGATION_PENDING', 'high', 'Partner homologation is not approved', 40));
  }
  if (snapshot.has_email !== true) {
    signals.push(signal('PARTY_EMAIL_MISSING', 'low', 'Business party has no email registered', 5));
  }
  if (snapshot.has_phone !== true) {
    signals.push(signal('PARTY_PHONE_MISSING', 'low', 'Business party has no phone registered', 5));
  }
  return signals;
}

function driverSignals(snapshot: Readonly<Record<string, unknown>>): ComplianceRiskSignal[] {
  const signals: ComplianceRiskSignal[] = [];
  if (snapshot.registration_status === 'blocked') {
    signals.push(signal('DRIVER_REGISTRATION_BLOCKED', 'critical', 'Driver registration is blocked', 80));
  } else if (snapshot.registration_status === 'pending') {
    signals.push(signal('DRIVER_REGISTRATION_PENDING', 'medium', 'Driver registration is pending', 30));
  } else if (snapshot.registration_status === 'inactive') {
    signals.push(signal('DRIVER_REGISTRATION_INACTIVE', 'medium', 'Driver registration is inactive', 30));
  }
  if (snapshot.operational_status === 'blocked') {
    signals.push(signal('DRIVER_OPERATIONAL_BLOCKED', 'critical', 'Driver operational status is blocked', 80));
  } else if (snapshot.operational_status === 'inactive') {
    signals.push(signal('DRIVER_OPERATIONAL_INACTIVE', 'medium', 'Driver operational status is inactive', 30));
  }
  if (snapshot.cnh_expired === true) {
    signals.push(signal('DRIVER_CNH_EXPIRED', 'critical', 'Driver license is expired', 80));
  }
  if (snapshot.has_carrier !== true) {
    signals.push(signal('DRIVER_CARRIER_MISSING', 'low', 'Driver is not linked to a carrier party', 10));
  }
  if (snapshot.has_email !== true) {
    signals.push(signal('DRIVER_EMAIL_MISSING', 'low', 'Driver has no email registered', 5));
  }
  return signals;
}

function assetSignals(snapshot: Readonly<Record<string, unknown>>): ComplianceRiskSignal[] {
  const signals: ComplianceRiskSignal[] = [];
  if (snapshot.status === 'blocked') {
    signals.push(signal('ASSET_BLOCKED', 'critical', 'Capacity asset is blocked', 80));
  } else if (snapshot.status === 'inactive') {
    signals.push(signal('ASSET_INACTIVE', 'medium', 'Capacity asset is inactive', 30));
  }
  if (snapshot.has_carrier !== true) {
    signals.push(signal('ASSET_CARRIER_MISSING', 'low', 'Capacity asset is not linked to a carrier party', 10));
  }
  return signals;
}

function documentSignals(snapshot: Readonly<Record<string, unknown>>): ComplianceRiskSignal[] {
  const signals: ComplianceRiskSignal[] = [];
  if (snapshot.status === 'rejected') {
    signals.push(signal('DOCUMENT_REJECTED', 'critical', 'Document status is rejected', 80));
  } else if (snapshot.status === 'expired' || snapshot.expired === true) {
    signals.push(signal('DOCUMENT_EXPIRED', 'critical', 'Document is expired', 80));
  } else if (snapshot.status === 'draft' || snapshot.status === 'pending') {
    signals.push(signal('DOCUMENT_PENDING', 'medium', 'Document is not yet valid', 30));
  } else if (snapshot.status === 'archived') {
    signals.push(signal('DOCUMENT_ARCHIVED', 'medium', 'Document is archived', 30));
  }

  if (snapshot.latest_validation_result === 'invalid') {
    signals.push(signal('DOCUMENT_VALIDATION_INVALID', 'critical', 'Latest document validation is invalid', 80));
  } else if (snapshot.latest_validation_result === 'review_required') {
    signals.push(signal('DOCUMENT_VALIDATION_REVIEW', 'high', 'Latest document validation requires review', 40));
  }
  return signals;
}

function signal(
  code: string,
  severity: ComplianceRiskSeverity,
  message: string,
  scoreDelta: number,
  details: Readonly<Record<string, unknown>> = {},
): ComplianceRiskSignal {
  return { code, severity, message, scoreDelta, details };
}

function normalizeSignal(value: ComplianceRiskSignal): ComplianceRiskSignal {
  const severity: ComplianceRiskSeverity = ['low', 'medium', 'high', 'critical'].includes(value.severity)
    ? value.severity
    : 'high';
  return {
    code: String(value.code).trim().slice(0, 120) || 'EXTERNAL_RISK_SIGNAL',
    severity,
    message: String(value.message).trim().slice(0, 500) || 'External risk signal',
    scoreDelta: clampScore(value.scoreDelta),
    details: value.details ?? {},
  };
}

function dedupeSignals(values: readonly ComplianceRiskSignal[]): ComplianceRiskSignal[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value.code)) return false;
    seen.add(value.code);
    return true;
  });
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveDecision(
  signals: readonly ComplianceRiskSignal[],
  score: number,
): ComplianceRiskDecision {
  if (signals.some((item) => item.severity === 'critical') || score >= 80) return 'block';
  if (signals.some((item) => item.severity === 'high') || score >= 40) return 'review';
  return 'approve';
}

function buildReason(
  decision: ComplianceRiskDecision,
  signals: readonly ComplianceRiskSignal[],
): string {
  if (signals.length === 0) return 'No risk signals were detected by the active assessment rules.';
  const relevant = signals
    .filter((item) =>
      decision === 'block'
        ? item.severity === 'critical'
        : decision === 'review'
          ? item.severity === 'high' || item.severity === 'medium'
          : true,
    )
    .slice(0, 5)
    .map((item) => item.code)
    .join(', ');
  return `Risk assessment decision ${decision}: ${relevant || signals[0]?.code || 'signals recorded'}.`;
}
