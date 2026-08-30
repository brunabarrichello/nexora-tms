import { sql } from 'drizzle-orm';
import {
  boolean,
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
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { capacityAssignments } from './capacity-assignment.js';
import { capacityAssets, drivers } from './capacity.js';
import { transportRequests } from './freight.js';
import { users } from './identity.js';
import { businessParties } from './master-data.js';
import { tenantMatchesSession } from './rls.js';

export const matchingRuleCategoryEnum = pgEnum('matching_rule_category', [
  'eligibility',
  'capacity',
  'equipment',
  'compliance',
  'availability',
  'commercial',
  'preference',
]);

export const matchingRunStatusEnum = pgEnum('matching_run_status', [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const matchingCandidateStatusEnum = pgEnum('matching_candidate_status', [
  'eligible',
  'rejected',
]);

export const matchingRuleResultEnum = pgEnum('matching_rule_result', [
  'passed',
  'failed',
  'not_applicable',
]);

export const matchingRuleImpactEnum = pgEnum('matching_rule_impact', [
  'blocker',
  'penalty',
  'bonus',
  'neutral',
]);

export const matchingRules = pgTable(
  'matching_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    code: varchar('code', { length: 96 }).notNull(),
    name: varchar('name', { length: 180 }).notNull(),
    description: varchar('description', { length: 1000 }),
    category: matchingRuleCategoryEnum('category').notNull(),
    version: integer('version').default(1).notNull(),
    isBlocking: boolean('is_blocking').default(false).notNull(),
    weight: numeric('weight', { precision: 8, scale: 4 }).default('1').notNull(),
    configuration: jsonb('configuration').$type<Record<string, unknown>>().default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('matching_rules_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('matching_rules_tenant_code_unique').on(table.tenantId, table.code),
    check('matching_rules_code_check', sql`length(trim(${table.code})) >= 2`),
    check('matching_rules_version_check', sql`${table.version} > 0`),
    check('matching_rules_weight_check', sql`${table.weight} >= 0`),
    index('matching_rules_tenant_active_category_idx').on(
      table.tenantId,
      table.isActive,
      table.category,
    ),
    pgPolicy('matching_rules_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const matchingPreferences = pgTable(
  'matching_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    minimumScore: numeric('minimum_score', { precision: 7, scale: 4 }).default('0').notNull(),
    maxCandidates: integer('max_candidates').default(100).notNull(),
    includeRejected: boolean('include_rejected').default(true).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    configuration: jsonb('configuration').$type<Record<string, unknown>>().default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('matching_preferences_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('matching_preferences_tenant_name_unique').on(table.tenantId, table.name),
    uniqueIndex('matching_preferences_tenant_default_unique')
      .on(table.tenantId)
      .where(sql`${table.isDefault} = true AND ${table.isActive} = true`),
    check(
      'matching_preferences_minimum_score_check',
      sql`${table.minimumScore} >= 0 AND ${table.minimumScore} <= 100`,
    ),
    check('matching_preferences_max_candidates_check', sql`${table.maxCandidates} > 0`),
    index('matching_preferences_tenant_active_idx').on(table.tenantId, table.isActive),
    pgPolicy('matching_preferences_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const matchingRuns = pgTable(
  'matching_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    transportRequestId: uuid('transport_request_id').notNull(),
    preferenceId: uuid('preference_id'),
    status: matchingRunStatusEnum('status').default('queued').notNull(),
    algorithmVersion: varchar('algorithm_version', { length: 64 }).notNull(),
    parametersSnapshot: jsonb('parameters_snapshot')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    rulesSnapshot: jsonb('rules_snapshot').$type<readonly Record<string, unknown>[]>().default([]).notNull(),
    evaluatedCount: integer('evaluated_count').default(0).notNull(),
    eligibleCount: integer('eligible_count').default(0).notNull(),
    rejectedCount: integer('rejected_count').default(0).notNull(),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failureCode: varchar('failure_code', { length: 96 }),
    failureMessage: varchar('failure_message', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('matching_runs_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.transportRequestId],
      foreignColumns: [transportRequests.tenantId, transportRequests.id],
      name: 'matching_runs_transport_request_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.preferenceId],
      foreignColumns: [matchingPreferences.tenantId, matchingPreferences.id],
      name: 'matching_runs_preference_fk',
    }).onDelete('restrict'),
    check(
      'matching_runs_counts_check',
      sql`${table.evaluatedCount} >= 0 AND ${table.eligibleCount} >= 0 AND ${table.rejectedCount} >= 0 AND ${table.evaluatedCount} = ${table.eligibleCount} + ${table.rejectedCount}`,
    ),
    check(
      'matching_runs_period_check',
      sql`${table.completedAt} IS NULL OR (${table.startedAt} IS NOT NULL AND ${table.completedAt} >= ${table.startedAt})`,
    ),
    check(
      'matching_runs_failure_check',
      sql`${table.status} <> 'failed' OR (${table.failureCode} IS NOT NULL AND ${table.failureMessage} IS NOT NULL)`,
    ),
    index('matching_runs_tenant_request_created_idx').on(
      table.tenantId,
      table.transportRequestId,
      table.createdAt,
    ),
    index('matching_runs_tenant_status_idx').on(table.tenantId, table.status),
    pgPolicy('matching_runs_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const matchingCandidates = pgTable(
  'matching_candidates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    matchingRunId: uuid('matching_run_id').notNull(),
    capacityAssignmentId: uuid('capacity_assignment_id').notNull(),
    driverId: uuid('driver_id').notNull(),
    capacityAssetId: uuid('capacity_asset_id').notNull(),
    carrierPartyId: uuid('carrier_party_id').notNull(),
    status: matchingCandidateStatusEnum('status').notNull(),
    rank: integer('rank'),
    totalScore: numeric('total_score', { precision: 9, scale: 4 }).default('0').notNull(),
    blockingReasonCount: integer('blocking_reason_count').default(0).notNull(),
    explanationSummary: jsonb('explanation_summary')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    candidateSnapshot: jsonb('candidate_snapshot')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('matching_candidates_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('matching_candidates_run_assignment_unique').on(
      table.tenantId,
      table.matchingRunId,
      table.capacityAssignmentId,
    ),
    foreignKey({
      columns: [table.tenantId, table.matchingRunId],
      foreignColumns: [matchingRuns.tenantId, matchingRuns.id],
      name: 'matching_candidates_run_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.capacityAssignmentId],
      foreignColumns: [capacityAssignments.tenantId, capacityAssignments.id],
      name: 'matching_candidates_assignment_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.driverId],
      foreignColumns: [drivers.tenantId, drivers.id],
      name: 'matching_candidates_driver_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.capacityAssetId],
      foreignColumns: [capacityAssets.tenantId, capacityAssets.id],
      name: 'matching_candidates_asset_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.carrierPartyId],
      foreignColumns: [businessParties.tenantId, businessParties.id],
      name: 'matching_candidates_carrier_fk',
    }).onDelete('restrict'),
    check('matching_candidates_rank_check', sql`${table.rank} IS NULL OR ${table.rank} > 0`),
    check(
      'matching_candidates_score_check',
      sql`${table.totalScore} >= 0 AND ${table.totalScore} <= 100`,
    ),
    check(
      'matching_candidates_blocking_count_check',
      sql`${table.blockingReasonCount} >= 0`,
    ),
    check(
      'matching_candidates_status_check',
      sql`(${table.status} = 'eligible' AND ${table.blockingReasonCount} = 0) OR (${table.status} = 'rejected' AND ${table.blockingReasonCount} > 0)`,
    ),
    index('matching_candidates_tenant_run_rank_idx').on(table.tenantId, table.matchingRunId, table.rank),
    index('matching_candidates_tenant_run_status_idx').on(
      table.tenantId,
      table.matchingRunId,
      table.status,
    ),
    pgPolicy('matching_candidates_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const matchingCandidateScores = pgTable(
  'matching_candidate_scores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    matchingCandidateId: uuid('matching_candidate_id').notNull(),
    dimensionCode: varchar('dimension_code', { length: 96 }).notNull(),
    rawScore: numeric('raw_score', { precision: 9, scale: 4 }).notNull(),
    weight: numeric('weight', { precision: 8, scale: 4 }).default('1').notNull(),
    weightedScore: numeric('weighted_score', { precision: 9, scale: 4 }).notNull(),
    rationale: varchar('rationale', { length: 1000 }),
    inputSnapshot: jsonb('input_snapshot').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('matching_candidate_scores_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('matching_candidate_scores_candidate_dimension_unique').on(
      table.tenantId,
      table.matchingCandidateId,
      table.dimensionCode,
    ),
    foreignKey({
      columns: [table.tenantId, table.matchingCandidateId],
      foreignColumns: [matchingCandidates.tenantId, matchingCandidates.id],
      name: 'matching_candidate_scores_candidate_fk',
    }).onDelete('restrict'),
    check(
      'matching_candidate_scores_raw_check',
      sql`${table.rawScore} >= 0 AND ${table.rawScore} <= 100`,
    ),
    check('matching_candidate_scores_weight_check', sql`${table.weight} >= 0`),
    index('matching_candidate_scores_tenant_candidate_idx').on(
      table.tenantId,
      table.matchingCandidateId,
    ),
    pgPolicy('matching_candidate_scores_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const matchingRuleResults = pgTable(
  'matching_rule_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    matchingCandidateId: uuid('matching_candidate_id').notNull(),
    matchingRuleId: uuid('matching_rule_id').notNull(),
    ruleCode: varchar('rule_code', { length: 96 }).notNull(),
    ruleVersion: integer('rule_version').notNull(),
    result: matchingRuleResultEnum('result').notNull(),
    impact: matchingRuleImpactEnum('impact').notNull(),
    scoreDelta: numeric('score_delta', { precision: 9, scale: 4 }).default('0').notNull(),
    message: varchar('message', { length: 1000 }).notNull(),
    requiredValue: jsonb('required_value'),
    actualValue: jsonb('actual_value'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('matching_rule_results_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('matching_rule_results_candidate_rule_unique').on(
      table.tenantId,
      table.matchingCandidateId,
      table.matchingRuleId,
    ),
    foreignKey({
      columns: [table.tenantId, table.matchingCandidateId],
      foreignColumns: [matchingCandidates.tenantId, matchingCandidates.id],
      name: 'matching_rule_results_candidate_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.matchingRuleId],
      foreignColumns: [matchingRules.tenantId, matchingRules.id],
      name: 'matching_rule_results_rule_fk',
    }).onDelete('restrict'),
    check('matching_rule_results_version_check', sql`${table.ruleVersion} > 0`),
    index('matching_rule_results_tenant_candidate_result_idx').on(
      table.tenantId,
      table.matchingCandidateId,
      table.result,
    ),
    pgPolicy('matching_rule_results_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);

export const matchingRejections = pgTable(
  'matching_rejections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    matchingCandidateId: uuid('matching_candidate_id').notNull(),
    matchingRuleResultId: uuid('matching_rule_result_id'),
    code: varchar('code', { length: 96 }).notNull(),
    reason: varchar('reason', { length: 1000 }).notNull(),
    context: jsonb('context').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('matching_rejections_tenant_id_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.matchingCandidateId],
      foreignColumns: [matchingCandidates.tenantId, matchingCandidates.id],
      name: 'matching_rejections_candidate_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.tenantId, table.matchingRuleResultId],
      foreignColumns: [matchingRuleResults.tenantId, matchingRuleResults.id],
      name: 'matching_rejections_rule_result_fk',
    }).onDelete('restrict'),
    check('matching_rejections_code_check', sql`length(trim(${table.code})) >= 2`),
    index('matching_rejections_tenant_candidate_idx').on(
      table.tenantId,
      table.matchingCandidateId,
      table.createdAt,
    ),
    index('matching_rejections_tenant_code_idx').on(table.tenantId, table.code),
    pgPolicy('matching_rejections_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: tenantMatchesSession(table.tenantId),
      withCheck: tenantMatchesSession(table.tenantId),
    }),
  ],
);
