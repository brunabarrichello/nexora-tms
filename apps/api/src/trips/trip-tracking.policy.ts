export interface TrackingPolicy {
  readonly staleAfterSeconds: number;
  readonly retentionDays: number;
}

interface TrackingPolicyOverride {
  readonly staleAfterSeconds?: unknown;
  readonly retentionDays?: unknown;
}

const DEFAULT_STALE_AFTER_SECONDS = 900;
const DEFAULT_RETENTION_DAYS = 90;

export function resolveTrackingPolicy(
  provider: string | null,
  env: NodeJS.ProcessEnv = process.env,
): TrackingPolicy {
  const base: TrackingPolicy = {
    staleAfterSeconds: parseInteger(
      env.TRACKING_STALE_AFTER_SECONDS,
      'TRACKING_STALE_AFTER_SECONDS',
      DEFAULT_STALE_AFTER_SECONDS,
      60,
      86_400,
    ),
    retentionDays: parseInteger(
      env.TRACKING_RETENTION_DAYS,
      'TRACKING_RETENTION_DAYS',
      DEFAULT_RETENTION_DAYS,
      1,
      3_650,
    ),
  };

  if (!provider || !env.TRACKING_PROVIDER_POLICIES_JSON) return base;

  let parsed: unknown;
  try {
    parsed = JSON.parse(env.TRACKING_PROVIDER_POLICIES_JSON);
  } catch {
    throw new Error('TRACKING_PROVIDER_POLICIES_JSON must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('TRACKING_PROVIDER_POLICIES_JSON must be an object');
  }
  const override = (parsed as Record<string, TrackingPolicyOverride>)[provider];
  if (!override) return base;
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    throw new Error(`Tracking policy for provider ${provider} must be an object`);
  }

  return {
    staleAfterSeconds: parseInteger(
      override.staleAfterSeconds,
      `tracking policy ${provider}.staleAfterSeconds`,
      base.staleAfterSeconds,
      60,
      86_400,
    ),
    retentionDays: parseInteger(
      override.retentionDays,
      `tracking policy ${provider}.retentionDays`,
      base.retentionDays,
      1,
      3_650,
    ),
  };
}

function parseInteger(
  value: unknown,
  label: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}
