import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkerConfig } from './config.js';

test('requires a worker database URL', () => {
  assert.throws(() => loadWorkerConfig({}), /WORKER_DATABASE_URL or DATABASE_URL is required/);
});

test('loads bounded worker defaults and explicit runtime values', () => {
  const config = loadWorkerConfig({
    WORKER_DATABASE_URL: 'postgresql://worker:secret@example.invalid/neondb',
    WORKER_ID: 'worker-test-1',
    APP_ENV: 'staging',
    PORT: '9090',
    WORKER_POLL_INTERVAL_MS: '250',
    WORKER_BATCH_SIZE: '12',
    WORKER_MAX_CONCURRENCY: '4',
  });

  assert.equal(config.workerId, 'worker-test-1');
  assert.equal(config.environment, 'staging');
  assert.equal(config.port, 9090);
  assert.equal(config.pollIntervalMs, 250);
  assert.equal(config.batchSize, 12);
  assert.equal(config.maxConcurrency, 4);
  assert.ok(config.readinessStaleAfterMs >= 15_000);
});

test('rejects unsafe worker bounds', () => {
  assert.throws(
    () =>
      loadWorkerConfig({
        DATABASE_URL: 'postgresql://worker:secret@example.invalid/neondb',
        WORKER_BATCH_SIZE: '9999',
      }),
    /WORKER_BATCH_SIZE must be an integer between 1 and 500/,
  );
});
