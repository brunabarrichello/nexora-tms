export type WorkerDatabaseConfig =
  | {
      kind: 'url';
      url: string;
    }
  | {
      kind: 'parameters';
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
    };

export interface WorkerConfig {
  database: WorkerDatabaseConfig;
  workerId: string;
  environment: string;
  host: string;
  port: number;
  pollIntervalMs: number;
  reaperIntervalMs: number;
  batchSize: number;
  leaseSeconds: number;
  handlerTimeoutMs: number;
  maxConcurrency: number;
  baseBackoffSeconds: number;
  maxBackoffSeconds: number;
  readinessStaleAfterMs: number;
}

type Environment = Record<string, string | undefined>;

function readInteger(
  env: Environment,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = env[key]?.trim();
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${key} must be an integer between ${minimum} and ${maximum}`);
  }

  return value;
}

function loadDatabaseConfig(env: Environment): WorkerDatabaseConfig {
  const url = env.WORKER_DATABASE_URL?.trim();
  if (url) {
    return { kind: 'url', url };
  }

  const host = env.WORKER_DATABASE_HOST?.trim();
  const password = env.WORKER_DATABASE_PASSWORD;
  if (!host || !password) {
    throw new Error(
      'WORKER_DATABASE_URL or WORKER_DATABASE_HOST + WORKER_DATABASE_PASSWORD is required',
    );
  }

  const user = env.WORKER_DATABASE_USER?.trim() || 'nexora_worker';
  if (user !== 'nexora_worker') {
    throw new Error('WORKER_DATABASE_USER must be nexora_worker');
  }

  return {
    kind: 'parameters',
    host,
    port: readInteger(env, 'WORKER_DATABASE_PORT', 5432, 1, 65_535),
    database: env.WORKER_DATABASE_NAME?.trim() || 'neondb',
    user,
    password,
  };
}

export function loadWorkerConfig(env: Environment = process.env): WorkerConfig {
  const pollIntervalMs = readInteger(env, 'WORKER_POLL_INTERVAL_MS', 1_000, 100, 60_000);
  const leaseSeconds = readInteger(env, 'WORKER_LEASE_SECONDS', 30, 2, 3_600);
  const maximumHandlerTimeoutMs = leaseSeconds * 1_000 - 1_000;
  const handlerTimeoutMs = readInteger(
    env,
    'WORKER_HANDLER_TIMEOUT_MS',
    Math.min(10_000, maximumHandlerTimeoutMs),
    100,
    maximumHandlerTimeoutMs,
  );

  return {
    database: loadDatabaseConfig(env),
    workerId: env.WORKER_ID?.trim() || `nexora-worker-${process.pid}`,
    environment: env.APP_ENV?.trim() || env.NODE_ENV?.trim() || 'development',
    host: env.WORKER_HEALTH_HOST?.trim() || '0.0.0.0',
    port: readInteger(env, 'PORT', 8080, 1, 65_535),
    pollIntervalMs,
    reaperIntervalMs: readInteger(env, 'WORKER_REAPER_INTERVAL_MS', 15_000, 1_000, 300_000),
    batchSize: readInteger(env, 'WORKER_BATCH_SIZE', 20, 1, 500),
    leaseSeconds,
    handlerTimeoutMs,
    maxConcurrency: readInteger(env, 'WORKER_MAX_CONCURRENCY', 8, 1, 100),
    baseBackoffSeconds: readInteger(env, 'WORKER_BASE_BACKOFF_SECONDS', 5, 1, 3_600),
    maxBackoffSeconds: readInteger(env, 'WORKER_MAX_BACKOFF_SECONDS', 900, 1, 86_400),
    readinessStaleAfterMs: readInteger(
      env,
      'WORKER_READINESS_STALE_AFTER_MS',
      Math.max(pollIntervalMs * 10, 15_000),
      1_000,
      600_000,
    ),
  };
}
