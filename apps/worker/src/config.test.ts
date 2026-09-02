import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkerConfig } from './config.js';

test('requires worker-specific database configuration', () => {
  assert.throws(
    () => loadWorkerConfig({}),
    /WORKER_DATABASE_URL or WORKER_DATABASE_HOST \+ WORKER_DATABASE_PASSWORD is required/,
  );
});

test('loads bounded worker defaults and explicit runtime values', () => {
  const config = loadWorkerConfig({
    WORKER_DATABASE_URL: 'postgresql://nexora_worker:secret@example.invalid/neondb',
    WORKER_ID: 'worker-test-1',
    APP_ENV: 'staging',
    PORT: '9090',
    WORKER_POLL_INTERVAL_MS: '250',
    WORKER_BATCH_SIZE: '12',
    WORKER_LEASE_SECONDS: '30',
    WORKER_HANDLER_TIMEOUT_MS: '9000',
    WORKER_MAX_CONCURRENCY: '4',
  });

  assert.deepEqual(config.database, {
    kind: 'url',
    url: 'postgresql://nexora_worker:secret@example.invalid/neondb',
  });
  assert.equal(config.workerId, 'worker-test-1');
  assert.equal(config.environment, 'staging');
  assert.equal(config.port, 9090);
  assert.equal(config.pollIntervalMs, 250);
  assert.equal(config.batchSize, 12);
  assert.equal(config.leaseSeconds, 30);
  assert.equal(config.handlerTimeoutMs, 9000);
  assert.equal(config.maxConcurrency, 4);
  assert.ok(config.readinessStaleAfterMs >= 15_000);
});

test('loads a TLS-enforced parameterized nexora_worker database configuration', () => {
  const config = loadWorkerConfig({
    WORKER_DATABASE_HOST: 'ep-example.us-east-2.aws.neon.tech',
    WORKER_DATABASE_PASSWORD: 'secret',
  });

  assert.deepEqual(config.database, {
    kind: 'parameters',
    host: 'ep-example.us-east-2.aws.neon.tech',
    port: 5432,
    database: 'neondb',
    user: 'nexora_worker',
    password: 'secret',
  });
});

test('rejects a non-worker database user', () => {
  assert.throws(
    () =>
      loadWorkerConfig({
        WORKER_DATABASE_HOST: 'ep-example.us-east-2.aws.neon.tech',
        WORKER_DATABASE_PASSWORD: 'secret',
        WORKER_DATABASE_USER: 'nexora_app',
      }),
    /WORKER_DATABASE_USER must be nexora_worker/,
  );
});

test('does not accept generic DATABASE_URL as a worker credential', () => {
  assert.throws(
    () => loadWorkerConfig({ DATABASE_URL: 'postgresql://nexora_app:secret@example.invalid/neondb' }),
    /WORKER_DATABASE_URL or WORKER_DATABASE_HOST \+ WORKER_DATABASE_PASSWORD is required/,
  );
});

test('rejects unsafe worker bounds', () => {
  assert.throws(
    () =>
      loadWorkerConfig({
        WORKER_DATABASE_URL: 'postgresql://nexora_worker:secret@example.invalid/neondb',
        WORKER_BATCH_SIZE: '9999',
      }),
    /WORKER_BATCH_SIZE must be an integer between 1 and 500/,
  );
});

test('rejects a handler deadline that can collide with lease expiry', () => {
  assert.throws(
    () =>
      loadWorkerConfig({
        WORKER_DATABASE_URL: 'postgresql://nexora_worker:secret@example.invalid/neondb',
        WORKER_LEASE_SECONDS: '5',
        WORKER_HANDLER_TIMEOUT_MS: '5000',
      }),
    /WORKER_HANDLER_TIMEOUT_MS must be an integer between 100 and 4000/,
  );
});
