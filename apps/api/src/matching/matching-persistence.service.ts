import { Injectable, NotFoundException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  type CapacityMismatchCode,
  type CapacityMismatchReason,
  type CargoMatchingRequirements,
} from './capacity-matching.js';
import {
  CapacityMatchingService,
  type CapacityMatchCandidate,
  type CapacityMatchingResult,
} from './capacity-matching.service.js';

const ALGORITHM_VERSION = 'capacity-v1';

type MatchingRuleCategory =
  | 'eligibility'
  | 'capacity'
  | 'equipment'
  | 'compliance'
  | 'availability'
  | 'commercial'
  | 'preference';

interface BuiltInRuleDefinition {
  readonly code: CapacityMismatchCode;
  readonly name: string;
  readonly description: string;
  readonly category: MatchingRuleCategory;
}

interface PersistedRuleRow {
  readonly id: string;
  readonly code: CapacityMismatchCode;
  readonly name: string;
  readonly description: string | null;
  readonly category: MatchingRuleCategory;
  readonly version: number;
  readonly is_blocking: boolean;
  readonly weight: string;
  readonly is_active: boolean;
}

interface PreferenceRow {
  readonly id: string;
  readonly name: string;
  readonly minimum_score: string;
  readonly max_candidates: number;
  readonly include_rejected: boolean;
  readonly is_default: boolean;
  readonly configuration: Record<string, unknown>;
}

interface RunRow {
  readonly id: string;
  readonly transport_request_id: string;
  readonly preference_id: string | null;
  readonly preference_name: string | null;
  readonly status: string;
  readonly algorithm_version: string;
  readonly parameters_snapshot: Record<string, unknown>;
  readonly rules_snapshot: readonly Record<string, unknown>[];
  readonly evaluated_count: number;
  readonly eligible_count: number;
  readonly rejected_count: number;
  readonly requested_by_user_id: string;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly failure_code: string | null;
  readonly failure_message: string | null;
  readonly created_at: Date;
}

interface CandidateHistoryRow {
  readonly id: string;
  readonly matching_run_id: string;
  readonly capacity_assignment_id: string;
  readonly driver_id: string;
  readonly capacity_asset_id: string;
  readonly carrier_party_id: string;
  readonly status: string;
  readonly rank: number | null;
  readonly total_score: string;
  readonly blocking_reason_count: number;
  readonly explanation_summary: Record<string, unknown>;
  readonly candidate_snapshot: Record<string, unknown>;
  readonly created_at: Date;
}

interface CandidateScoreRow {
  readonly id: string;
  readonly dimension_code: string;
  readonly raw_score: string;
  readonly weight: string;
  readonly weighted_score: string;
  readonly rationale: string | null;
  readonly input_snapshot: Record<string, unknown>;
}

interface RuleResultRow {
  readonly id: string;
  readonly matching_rule_id: string;
  readonly rule_code: string;
  readonly rule_version: number;
  readonly result: string;
  readonly impact: string;
  readonly score_delta: string;
  readonly message: string;
  readonly required_value: unknown;
  readonly actual_value: unknown;
}

interface RejectionRow {
  readonly id: string;
  readonly matching_rule_result_id: string | null;
  readonly code: string;
  readonly reason: string;
  readonly context: Record<string, unknown>;
  readonly created_at: Date;
}

const BUILT_IN_RULES: readonly BuiltInRuleDefinition[] = [
  {
    code: 'driver_not_qualified',
    name: 'Motorista qualificado',
    description: 'Exige motorista com cadastro qualificado.',
    category: 'compliance',
  },
  {
    code: 'driver_not_active',
    name: 'Motorista operacionalmente ativo',
    description: 'Exige motorista operacionalmente ativo.',
    category: 'availability',
  },
  {
    code: 'vehicle_not_active',
    name: 'Veículo ativo',
    description: 'Exige ativo de capacidade operacionalmente ativo.',
    category: 'availability',
  },
  {
    code: 'vehicle_type_mismatch',
    name: 'Tipo de veículo compatível',
    description: 'Compara o tipo de veículo exigido com o cadastrado.',
    category: 'equipment',
  },
  {
    code: 'body_type_mismatch',
    name: 'Carroceria compatível',
    description: 'Compara a carroceria exigida com a cadastrada.',
    category: 'equipment',
  },
  {
    code: 'weight_capacity_insufficient',
    name: 'Capacidade de peso',
    description: 'Valida capacidade de peso contra o peso total da carga.',
    category: 'capacity',
  },
  {
    code: 'volume_capacity_unknown',
    name: 'Capacidade volumétrica conhecida',
    description: 'Exige capacidade volumétrica cadastrada quando a carga possui cubagem.',
    category: 'capacity',
  },
  {
    code: 'volume_capacity_insufficient',
    name: 'Capacidade volumétrica suficiente',
    description: 'Valida a cubagem disponível contra a cubagem da carga.',
    category: 'capacity',
  },
  {
    code: 'dimensions_capacity_unknown',
    name: 'Dimensões úteis conhecidas',
    description: 'Exige dimensões úteis cadastradas quando a carga possui limites dimensionais.',
    category: 'capacity',
  },
  {
    code: 'length_capacity_insufficient',
    name: 'Comprimento útil suficiente',
    description: 'Valida comprimento útil contra o comprimento máximo da carga.',
    category: 'capacity',
  },
  {
    code: 'width_capacity_insufficient',
    name: 'Largura útil suficiente',
    description: 'Valida largura útil contra a largura máxima da carga.',
    category: 'capacity',
  },
  {
    code: 'height_capacity_insufficient',
    name: 'Altura útil suficiente',
    description: 'Valida altura útil contra a altura máxima da carga.',
    category: 'capacity',
  },
  {
    code: 'tracking_unavailable',
    name: 'Rastreamento disponível',
    description: 'Exige rastreamento disponível quando a carga requer tracking.',
    category: 'equipment',
  },
];

@Injectable()
export class MatchingPersistenceService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
    private readonly capacityMatching: CapacityMatchingService,
  ) {}

  async execute(requestId: string, preferenceId?: string) {
    const transportRequestId = requireUuid(requestId, 'requestId');
    const normalizedPreferenceId = preferenceId
      ? requireUuid(preferenceId, 'preferenceId')
      : undefined;
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const evaluation = await this.capacityMatching.evaluateForRequest(transportRequestId, client);
      const rules = await this.ensureBuiltInRules(client, context.tenantId);
      const preference = await this.resolvePreference(client, normalizedPreferenceId);

      const runResult = await client.query<{ id: string }>(
        `INSERT INTO matching_runs (
           tenant_id, transport_request_id, preference_id, status, algorithm_version,
           parameters_snapshot, rules_snapshot, requested_by_user_id, started_at
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,'running',$4,$5::jsonb,$6::jsonb,$7::uuid,now()
         ) RETURNING id::text AS id`,
        [
          context.tenantId,
          transportRequestId,
          preference?.id ?? null,
          ALGORITHM_VERSION,
          JSON.stringify({ requirements: evaluation.requirements, preference }),
          JSON.stringify(rules.map(ruleSnapshot)),
          context.userId,
        ],
      );
      const runId = runResult.rows[0]?.id;
      if (!runId) {
        throw new Error('Matching run insert did not return an id');
      }

      await this.persistCandidates(client, context.tenantId, runId, evaluation, rules);

      await client.query(
        `UPDATE matching_runs
            SET status='completed',
                evaluated_count=$2,
                eligible_count=$3,
                rejected_count=$4,
                completed_at=now(),
                updated_at=now()
          WHERE id=$1::uuid`,
        [
          runId,
          evaluation.summary.evaluated,
          evaluation.summary.compatible,
          evaluation.summary.incompatible,
        ],
      );

      return {
        runId,
        status: 'completed' as const,
        algorithmVersion: ALGORITHM_VERSION,
        preference,
        result: evaluation,
      };
    });
  }

  async listRuns(requestId: string) {
    const transportRequestId = requireUuid(requestId, 'requestId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<RunRow>(
        `${runSelect()}
          WHERE r.transport_request_id=$1::uuid
          ORDER BY r.created_at DESC
          LIMIT 100`,
        [transportRequestId],
      );
      return result.rows.map(mapRun);
    });
  }

  async getRun(runId: string) {
    const id = requireUuid(runId, 'runId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<RunRow>(`${runSelect()} WHERE r.id=$1::uuid`, [id]);
      const row = result.rows[0];
      if (!row) {
        throw new NotFoundException('Matching run not found in current tenant');
      }
      return mapRun(row);
    });
  }

  async listCandidates(runId: string) {
    const id = requireUuid(runId, 'runId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<CandidateHistoryRow>(
        `SELECT id::text AS id,
                matching_run_id::text AS matching_run_id,
                capacity_assignment_id::text AS capacity_assignment_id,
                driver_id::text AS driver_id,
                capacity_asset_id::text AS capacity_asset_id,
                carrier_party_id::text AS carrier_party_id,
                status::text AS status,
                rank,
                total_score::text AS total_score,
                blocking_reason_count,
                explanation_summary,
                candidate_snapshot,
                created_at
           FROM matching_candidates
          WHERE matching_run_id=$1::uuid
          ORDER BY status,rank NULLS LAST,created_at,id`,
        [id],
      );
      return result.rows.map(mapCandidateHistory);
    });
  }

  async getCandidateExplanation(candidateId: string) {
    const id = requireUuid(candidateId, 'candidateId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const candidateResult = await client.query<CandidateHistoryRow>(
        `SELECT id::text AS id,
                matching_run_id::text AS matching_run_id,
                capacity_assignment_id::text AS capacity_assignment_id,
                driver_id::text AS driver_id,
                capacity_asset_id::text AS capacity_asset_id,
                carrier_party_id::text AS carrier_party_id,
                status::text AS status,
                rank,
                total_score::text AS total_score,
                blocking_reason_count,
                explanation_summary,
                candidate_snapshot,
                created_at
           FROM matching_candidates
          WHERE id=$1::uuid`,
        [id],
      );
      const candidate = candidateResult.rows[0];
      if (!candidate) {
        throw new NotFoundException('Matching candidate not found in current tenant');
      }

      const [scores, rules, rejections] = await Promise.all([
        client.query<CandidateScoreRow>(
          `SELECT id::text AS id,dimension_code,raw_score::text AS raw_score,
                  weight::text AS weight,weighted_score::text AS weighted_score,
                  rationale,input_snapshot
             FROM matching_candidate_scores
            WHERE matching_candidate_id=$1::uuid
            ORDER BY dimension_code`,
          [id],
        ),
        client.query<RuleResultRow>(
          `SELECT id::text AS id,matching_rule_id::text AS matching_rule_id,rule_code,
                  rule_version,result::text AS result,impact::text AS impact,
                  score_delta::text AS score_delta,message,required_value,actual_value
             FROM matching_rule_results
            WHERE matching_candidate_id=$1::uuid
            ORDER BY rule_code`,
          [id],
        ),
        client.query<RejectionRow>(
          `SELECT id::text AS id,matching_rule_result_id::text AS matching_rule_result_id,
                  code,reason,context,created_at
             FROM matching_rejections
            WHERE matching_candidate_id=$1::uuid
            ORDER BY created_at,id`,
          [id],
        ),
      ]);

      return {
        candidate: mapCandidateHistory(candidate),
        scores: scores.rows.map((row) => ({
          id: row.id,
          dimensionCode: row.dimension_code,
          rawScore: Number(row.raw_score),
          weight: Number(row.weight),
          weightedScore: Number(row.weighted_score),
          rationale: row.rationale,
          inputSnapshot: row.input_snapshot,
        })),
        ruleResults: rules.rows.map((row) => ({
          id: row.id,
          matchingRuleId: row.matching_rule_id,
          ruleCode: row.rule_code,
          ruleVersion: row.rule_version,
          result: row.result,
          impact: row.impact,
          scoreDelta: Number(row.score_delta),
          message: row.message,
          requiredValue: row.required_value,
          actualValue: row.actual_value,
        })),
        rejections: rejections.rows.map((row) => ({
          id: row.id,
          matchingRuleResultId: row.matching_rule_result_id,
          code: row.code,
          reason: row.reason,
          context: row.context,
          createdAt: row.created_at.toISOString(),
        })),
      };
    });
  }

  async listRules() {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const rules = await this.ensureBuiltInRules(client, context.tenantId);
      return rules.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        category: row.category,
        version: row.version,
        isBlocking: row.is_blocking,
        weight: Number(row.weight),
        isActive: row.is_active,
      }));
    });
  }

  async listPreferences() {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<PreferenceRow>(
        `SELECT id::text AS id,name,minimum_score::text AS minimum_score,max_candidates,
                include_rejected,is_default,configuration
           FROM matching_preferences
          WHERE is_active=true
          ORDER BY is_default DESC,name,id`,
      );
      return result.rows.map(mapPreference);
    });
  }

  private async ensureBuiltInRules(
    client: TenantQueryClient,
    tenantId: string,
  ): Promise<readonly PersistedRuleRow[]> {
    const rows: PersistedRuleRow[] = [];
    for (const definition of BUILT_IN_RULES) {
      const result = await client.query<PersistedRuleRow>(
        `INSERT INTO matching_rules (
           tenant_id,code,name,description,category,version,is_blocking,weight,configuration,is_active
         ) VALUES ($1::uuid,$2,$3,$4,$5,1,true,1,'{}'::jsonb,true)
         ON CONFLICT (tenant_id,code) DO UPDATE
           SET name=EXCLUDED.name,
               description=EXCLUDED.description,
               category=EXCLUDED.category,
               version=EXCLUDED.version,
               is_blocking=true,
               is_active=true,
               updated_at=now()
         RETURNING id::text AS id,code,name,description,category::text AS category,
                   version,is_blocking,weight::text AS weight,is_active`,
        [tenantId, definition.code, definition.name, definition.description, definition.category],
      );
      const row = result.rows[0];
      if (!row) {
        throw new Error(`Matching rule ${definition.code} did not return an id`);
      }
      rows.push(row);
    }
    return rows;
  }

  private async resolvePreference(
    client: TenantQueryClient,
    preferenceId?: string,
  ): Promise<ReturnType<typeof mapPreference> | null> {
    const result = preferenceId
      ? await client.query<PreferenceRow>(
          `SELECT id::text AS id,name,minimum_score::text AS minimum_score,max_candidates,
                  include_rejected,is_default,configuration
             FROM matching_preferences
            WHERE id=$1::uuid AND is_active=true`,
          [preferenceId],
        )
      : await client.query<PreferenceRow>(
          `SELECT id::text AS id,name,minimum_score::text AS minimum_score,max_candidates,
                  include_rejected,is_default,configuration
             FROM matching_preferences
            WHERE is_default=true AND is_active=true
            ORDER BY created_at,id
            LIMIT 1`,
        );

    if (preferenceId && !result.rows[0]) {
      throw new NotFoundException('Matching preference not found in current tenant');
    }
    return result.rows[0] ? mapPreference(result.rows[0]) : null;
  }

  private async persistCandidates(
    client: TenantQueryClient,
    tenantId: string,
    runId: string,
    evaluation: CapacityMatchingResult,
    rules: readonly PersistedRuleRow[],
  ): Promise<void> {
    const candidates = [...evaluation.compatible, ...evaluation.incompatible];
    let eligibleRank = 0;

    for (const candidate of candidates) {
      const score = candidate.compatible ? 100 : 0;
      const rank = candidate.compatible ? ++eligibleRank : null;
      const candidateResult = await client.query<{ id: string }>(
        `INSERT INTO matching_candidates (
           tenant_id,matching_run_id,capacity_assignment_id,driver_id,capacity_asset_id,
           carrier_party_id,status,rank,total_score,blocking_reason_count,
           explanation_summary,candidate_snapshot
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7,$8,$9,$10,$11::jsonb,$12::jsonb
         ) RETURNING id::text AS id`,
        [
          tenantId,
          runId,
          candidate.assignmentId,
          candidate.driver.id,
          candidate.vehicle.id,
          candidate.carrier.id,
          candidate.compatible ? 'eligible' : 'rejected',
          rank,
          score,
          candidate.reasons.length,
          JSON.stringify({
            compatible: candidate.compatible,
            reasonCodes: candidate.reasons.map((reason) => reason.code),
          }),
          JSON.stringify(candidateSnapshot(candidate)),
        ],
      );
      const candidateId = candidateResult.rows[0]?.id;
      if (!candidateId) {
        throw new Error('Matching candidate insert did not return an id');
      }

      await client.query(
        `INSERT INTO matching_candidate_scores (
           tenant_id,matching_candidate_id,dimension_code,raw_score,weight,weighted_score,
           rationale,input_snapshot
         ) VALUES ($1::uuid,$2::uuid,'compatibility',$3,1,$3,$4,$5::jsonb)`,
        [
          tenantId,
          candidateId,
          score,
          candidate.compatible
            ? 'Todos os critérios bloqueadores aplicáveis foram atendidos.'
            : 'Um ou mais critérios bloqueadores não foram atendidos.',
          JSON.stringify({ requirements: evaluation.requirements }),
        ],
      );

      for (const rule of rules) {
        const reason = candidate.reasons.find((item) => item.code === rule.code);
        const applicable = isRuleApplicable(rule.code, evaluation.requirements, candidate);
        const resultState = reason ? 'failed' : applicable ? 'passed' : 'not_applicable';
        const impact = reason ? 'blocker' : 'neutral';
        const message =
          reason?.message ??
          (applicable ? 'Critério atendido.' : 'Critério não aplicável à carga/candidato.');

        const ruleResult = await client.query<{ id: string }>(
          `INSERT INTO matching_rule_results (
             tenant_id,matching_candidate_id,matching_rule_id,rule_code,rule_version,
             result,impact,score_delta,message,required_value,actual_value
           ) VALUES (
             $1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,0,$8,$9::jsonb,$10::jsonb
           ) RETURNING id::text AS id`,
          [
            tenantId,
            candidateId,
            rule.id,
            rule.code,
            rule.version,
            resultState,
            impact,
            message,
            jsonScalar(reason?.required),
            jsonScalar(reason?.available),
          ],
        );

        if (reason) {
          const ruleResultId = ruleResult.rows[0]?.id;
          if (!ruleResultId) {
            throw new Error('Matching rule result insert did not return an id');
          }
          await client.query(
            `INSERT INTO matching_rejections (
               tenant_id,matching_candidate_id,matching_rule_result_id,code,reason,context
             ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::jsonb)`,
            [
              tenantId,
              candidateId,
              ruleResultId,
              reason.code,
              reason.message,
              JSON.stringify({
                required: reason.required ?? null,
                available: reason.available ?? null,
              }),
            ],
          );
        }
      }
    }
  }
}

function runSelect(): string {
  return `SELECT r.id::text AS id,
                 r.transport_request_id::text AS transport_request_id,
                 r.preference_id::text AS preference_id,
                 p.name AS preference_name,
                 r.status::text AS status,
                 r.algorithm_version,
                 r.parameters_snapshot,
                 r.rules_snapshot,
                 r.evaluated_count,
                 r.eligible_count,
                 r.rejected_count,
                 r.requested_by_user_id::text AS requested_by_user_id,
                 r.started_at,
                 r.completed_at,
                 r.failure_code,
                 r.failure_message,
                 r.created_at
            FROM matching_runs r
            LEFT JOIN matching_preferences p
              ON p.tenant_id=r.tenant_id AND p.id=r.preference_id`;
}

function mapRun(row: RunRow) {
  return {
    id: row.id,
    transportRequestId: row.transport_request_id,
    preferenceId: row.preference_id,
    preferenceName: row.preference_name,
    status: row.status,
    algorithmVersion: row.algorithm_version,
    parametersSnapshot: row.parameters_snapshot,
    rulesSnapshot: row.rules_snapshot,
    evaluatedCount: row.evaluated_count,
    eligibleCount: row.eligible_count,
    rejectedCount: row.rejected_count,
    requestedByUserId: row.requested_by_user_id,
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    createdAt: row.created_at.toISOString(),
  };
}

function mapCandidateHistory(row: CandidateHistoryRow) {
  return {
    id: row.id,
    matchingRunId: row.matching_run_id,
    capacityAssignmentId: row.capacity_assignment_id,
    driverId: row.driver_id,
    capacityAssetId: row.capacity_asset_id,
    carrierPartyId: row.carrier_party_id,
    status: row.status,
    rank: row.rank,
    totalScore: Number(row.total_score),
    blockingReasonCount: row.blocking_reason_count,
    explanationSummary: row.explanation_summary,
    candidateSnapshot: row.candidate_snapshot,
    createdAt: row.created_at.toISOString(),
  };
}

function mapPreference(row: PreferenceRow) {
  return {
    id: row.id,
    name: row.name,
    minimumScore: Number(row.minimum_score),
    maxCandidates: row.max_candidates,
    includeRejected: row.include_rejected,
    isDefault: row.is_default,
    configuration: row.configuration,
  };
}

function ruleSnapshot(rule: PersistedRuleRow) {
  return {
    id: rule.id,
    code: rule.code,
    name: rule.name,
    description: rule.description,
    category: rule.category,
    version: rule.version,
    isBlocking: rule.is_blocking,
    weight: Number(rule.weight),
    isActive: rule.is_active,
  };
}

function candidateSnapshot(candidate: CapacityMatchCandidate) {
  return {
    assignmentId: candidate.assignmentId,
    driver: candidate.driver,
    vehicle: candidate.vehicle,
    carrier: candidate.carrier,
    assignmentStartsAt: candidate.assignmentStartsAt,
  };
}

function jsonScalar(
  value: CapacityMismatchReason['required'] | CapacityMismatchReason['available'],
) {
  return value === undefined ? null : JSON.stringify(value);
}

function isRuleApplicable(
  code: CapacityMismatchCode,
  requirements: CargoMatchingRequirements,
  candidate: CapacityMatchCandidate,
): boolean {
  switch (code) {
    case 'volume_capacity_unknown':
      return requirements.cubageM3 !== null && candidate.vehicle.capacityVolumeM3 === null;
    case 'volume_capacity_insufficient':
      return requirements.cubageM3 !== null && candidate.vehicle.capacityVolumeM3 !== null;
    case 'dimensions_capacity_unknown':
      return (
        hasCargoDimensions(requirements) &&
        (candidate.vehicle.maxLengthM === null ||
          candidate.vehicle.maxWidthM === null ||
          candidate.vehicle.maxHeightM === null)
      );
    case 'length_capacity_insufficient':
      return requirements.maxLengthM !== null && candidate.vehicle.maxLengthM !== null;
    case 'width_capacity_insufficient':
      return requirements.maxWidthM !== null && candidate.vehicle.maxWidthM !== null;
    case 'height_capacity_insufficient':
      return requirements.maxHeightM !== null && candidate.vehicle.maxHeightM !== null;
    case 'tracking_unavailable':
      return requirements.trackingRequired;
    default:
      return true;
  }
}

function hasCargoDimensions(requirements: CargoMatchingRequirements): boolean {
  return (
    requirements.maxLengthM !== null ||
    requirements.maxWidthM !== null ||
    requirements.maxHeightM !== null
  );
}
