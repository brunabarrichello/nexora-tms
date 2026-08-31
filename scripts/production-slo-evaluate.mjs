import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function parsePositiveNumber(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

function parseTargetAvailability() {
  const value = parsePositiveNumber('SLO_TARGET_AVAILABILITY', 0.99);
  if (value <= 0 || value > 1) {
    throw new Error('SLO_TARGET_AVAILABILITY must be greater than 0 and at most 1');
  }
  return value;
}

function parseTimestamp(value) {
  const timestamp = Date.parse(value ?? '');
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function parseOptionalDate(name) {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;

  const timestamp = parseTimestamp(raw);
  if (timestamp === undefined) {
    throw new Error(`${name} must be a valid ISO-8601 timestamp`);
  }
  return new Date(timestamp);
}

function flattenRuns(value) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (entry && typeof entry === 'object' && Array.isArray(entry.workflow_runs)) {
        return entry.workflow_runs;
      }
      return entry;
    });
  }

  if (value && typeof value === 'object' && Array.isArray(value.workflow_runs)) {
    return value.workflow_runs;
  }

  throw new Error('SLO input must be an array of workflow runs or a GitHub workflow-runs payload');
}

export function evaluateProductionSlo(
  input,
  {
    now = new Date(),
    windowHours = parsePositiveNumber('SLO_WINDOW_HOURS', 168),
    targetAvailability = parseTargetAvailability(),
    minimumSamples = parsePositiveNumber('SLO_MINIMUM_SAMPLES', 12),
    staleAfterMinutes = parsePositiveNumber('SLO_STALE_AFTER_MINUTES', 90),
    monitorActivatedAt = parseOptionalDate('SLO_MONITOR_ACTIVATED_AT'),
  } = {},
) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('now must be a valid Date');
  }
  if (!Number.isInteger(minimumSamples)) {
    throw new Error('minimumSamples must be an integer');
  }
  if (
    monitorActivatedAt !== undefined &&
    (!(monitorActivatedAt instanceof Date) || Number.isNaN(monitorActivatedAt.getTime()))
  ) {
    throw new Error('monitorActivatedAt must be a valid Date when provided');
  }

  const runs = flattenRuns(input).filter((run) => run && typeof run === 'object');
  const nowMs = now.getTime();
  const cutoffMs = nowMs - windowHours * 60 * 60 * 1000;

  const scheduledRuns = runs
    .filter((run) => run.event === 'schedule')
    .map((run) => ({ ...run, createdAtMs: parseTimestamp(run.created_at) }))
    .filter((run) => run.createdAtMs !== undefined && run.createdAtMs <= nowMs)
    .sort((left, right) => right.createdAtMs - left.createdAtMs);

  const latestScheduledRun = scheduledRuns[0];
  const monitorReferenceAt = latestScheduledRun?.createdAtMs ?? monitorActivatedAt?.getTime();
  const latestScheduledAgeMinutes =
    monitorReferenceAt === undefined ? null : (nowMs - monitorReferenceAt) / 60_000;
  const monitorStale =
    latestScheduledAgeMinutes !== null && latestScheduledAgeMinutes > staleAfterMinutes;

  const completedWindowRuns = scheduledRuns.filter(
    (run) =>
      run.createdAtMs >= cutoffMs &&
      run.status === 'completed' &&
      typeof run.conclusion === 'string',
  );
  const successfulSamples = completedWindowRuns.filter(
    (run) => run.conclusion === 'success',
  ).length;
  const sampleCount = completedWindowRuns.length;
  const failedSamples = sampleCount - successfulSamples;
  const availability = sampleCount > 0 ? successfulSamples / sampleCount : null;
  const errorBudgetFraction = 1 - targetAvailability;
  const errorBudgetSamples = sampleCount * errorBudgetFraction;
  const errorBudgetConsumed =
    errorBudgetSamples > 0 ? failedSamples / errorBudgetSamples : failedSamples > 0 ? Infinity : 0;
  const maxFailedSamplesWithinSlo = Math.floor(errorBudgetSamples + Number.EPSILON);
  const remainingFailureSamples = Math.max(0, maxFailedSamplesWithinSlo - failedSamples);

  let state = 'healthy';
  if (!latestScheduledRun || sampleCount < minimumSamples) {
    state = 'insufficient_data';
  }
  if (monitorStale) {
    state = 'monitor_stale';
  } else if (
    sampleCount >= minimumSamples &&
    availability !== null &&
    availability < targetAvailability
  ) {
    state = 'budget_exhausted';
  }

  return {
    state,
    windowHours,
    targetAvailability,
    minimumSamples,
    staleAfterMinutes,
    monitorActivatedAt: monitorActivatedAt?.toISOString() ?? null,
    sampleCount,
    successfulSamples,
    failedSamples,
    availability,
    availabilityPercent: availability === null ? null : Number((availability * 100).toFixed(4)),
    errorBudgetPercent: Number((errorBudgetFraction * 100).toFixed(4)),
    errorBudgetConsumedPercent: Number.isFinite(errorBudgetConsumed)
      ? Number((errorBudgetConsumed * 100).toFixed(2))
      : null,
    maxFailedSamplesWithinSlo,
    remainingFailureSamples,
    latestScheduledRunId: latestScheduledRun?.id ?? null,
    latestScheduledRunAt: latestScheduledRun?.created_at ?? null,
    latestScheduledAgeMinutes:
      latestScheduledAgeMinutes === null ? null : Number(latestScheduledAgeMinutes.toFixed(2)),
  };
}

function syntheticRuns({ successes, failures, now, latestAgeMinutes = 5 }) {
  const total = successes + failures;
  return Array.from({ length: total }, (_, index) => ({
    id: index + 1,
    event: 'schedule',
    status: 'completed',
    conclusion: index < failures ? 'failure' : 'success',
    created_at: new Date(now.getTime() - (latestAgeMinutes + index) * 60_000).toISOString(),
  }));
}

function selfTest() {
  const now = new Date('2026-08-31T12:00:00.000Z');
  const options = {
    now,
    windowHours: 168,
    targetAvailability: 0.99,
    minimumSamples: 12,
    staleAfterMinutes: 90,
    monitorActivatedAt: new Date('2026-08-31T08:00:00.000Z'),
  };

  const healthy = evaluateProductionSlo(
    syntheticRuns({ successes: 99, failures: 1, now }),
    options,
  );
  assert.equal(healthy.state, 'healthy');
  assert.equal(healthy.availability, 0.99);

  const exhausted = evaluateProductionSlo(
    syntheticRuns({ successes: 98, failures: 2, now }),
    options,
  );
  assert.equal(exhausted.state, 'budget_exhausted');

  const insufficient = evaluateProductionSlo(
    syntheticRuns({ successes: 5, failures: 0, now }),
    options,
  );
  assert.equal(insufficient.state, 'insufficient_data');

  const stale = evaluateProductionSlo(
    syntheticRuns({ successes: 20, failures: 0, now, latestAgeMinutes: 120 }),
    options,
  );
  assert.equal(stale.state, 'monitor_stale');

  const neverStartedStale = evaluateProductionSlo([], options);
  assert.equal(neverStartedStale.state, 'monitor_stale');

  const recentActivation = evaluateProductionSlo([], {
    ...options,
    monitorActivatedAt: new Date('2026-08-31T11:30:00.000Z'),
  });
  assert.equal(recentActivation.state, 'insufficient_data');

  process.stdout.write('Production SLO evaluator self-test passed.\n');
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Usage: node scripts/production-slo-evaluate.mjs <workflow-runs.json>');
  }

  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  process.stdout.write(`${JSON.stringify(evaluateProductionSlo(input), null, 2)}\n`);
}
