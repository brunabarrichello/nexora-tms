import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkerConfig } from './config.js';
import { HandlerRegistry } from './handlers.js';
import { StructuredLogger } from './logger.js';
import { WorkerRuntime } from './runtime.js';
import type { AsyncStore, DurableJobWorkItem, FailureStatus, OutboxWorkItem } from './store.js';

class FakeStore implements AsyncStore {
  private delivered = false;
  completedJobIds: string[] = [];
  failedJobIds: string[] = [];

  async connect(): Promise<{ role: string; database: string }> {
    return { role: 'nexora_worker', database: 'neondb' };
  }

  async close(): Promise<void> {}

  async reapExpiredLeases(): Promise<{ outbox: number; jobs: number }> {
    return { outbox: 0, jobs: 0 };
  }

  async claimOutbox(): Promise<OutboxWorkItem[]> {
    return [];
  }

  async claimJobs(): Promise<DurableJobWorkItem[]> {
    if (this.delivered) {
      return [];
    }
    this.delivered = true;
    return [
      {
        id: 'job-1',
        tenant_id: 'tenant-1',
        source_outbox_event_id: null,
        job_type: 'nexora.worker.smoke',
        payload: { smoke: true },
        attempt: 1,
        max_attempts: 3,
        correlation_id: 'corr-1',
        request_id: 'req-1',
        idempotency_key: 'smoke-1',
      },
    ];
  }

  async completeOutbox(): Promise<boolean> {
    return true;
  }

  async completeJob(id: string): Promise<boolean> {
    this.completedJobIds.push(id);
    return true;
  }

  async failOutbox(): Promise<FailureStatus> {
    return 'retry_wait';
  }

  async failJob(id: string): Promise<FailureStatus> {
    this.failedJobIds.push(id);
    return 'retry_wait';
  }
}

test('claims and completes a registered durable job handler', async () => {
  const config = loadWorkerConfig({
    DATABASE_URL: 'postgresql://worker:secret@example.invalid/neondb',
    WORKER_ID: 'worker-unit-test',
    WORKER_POLL_INTERVAL_MS: '100',
    WORKER_REAPER_INTERVAL_MS: '1000',
    WORKER_READINESS_STALE_AFTER_MS: '1000',
  });
  const store = new FakeStore();
  const logger = new StructuredLogger(config.workerId, 'test');
  const registry = new HandlerRegistry().registerJob('nexora.worker.smoke', async () => {});
  const runtime = new WorkerRuntime(config, store, registry, logger);

  await runtime.start();
  await new Promise((resolve) => setTimeout(resolve, 25));
  await runtime.stop();

  assert.deepEqual(store.completedJobIds, ['job-1']);
  assert.deepEqual(store.failedJobIds, []);
  assert.equal(runtime.snapshot().completed, 1);
});

test('routes missing handlers through durable retry instead of acknowledging work', async () => {
  const config = loadWorkerConfig({
    DATABASE_URL: 'postgresql://worker:secret@example.invalid/neondb',
    WORKER_ID: 'worker-unit-test-missing-handler',
    WORKER_POLL_INTERVAL_MS: '100',
    WORKER_REAPER_INTERVAL_MS: '1000',
    WORKER_READINESS_STALE_AFTER_MS: '1000',
  });
  const store = new FakeStore();
  const logger = new StructuredLogger(config.workerId, 'test');
  const runtime = new WorkerRuntime(config, store, new HandlerRegistry(), logger);

  await runtime.start();
  await new Promise((resolve) => setTimeout(resolve, 25));
  await runtime.stop();

  assert.deepEqual(store.completedJobIds, []);
  assert.deepEqual(store.failedJobIds, ['job-1']);
  assert.equal(runtime.snapshot().failed, 1);
});

test('aborts and retries a handler before its lease can expire', async () => {
  const config = loadWorkerConfig({
    DATABASE_URL: 'postgresql://worker:secret@example.invalid/neondb',
    WORKER_ID: 'worker-unit-test-timeout',
    WORKER_POLL_INTERVAL_MS: '100',
    WORKER_REAPER_INTERVAL_MS: '1000',
    WORKER_READINESS_STALE_AFTER_MS: '1000',
    WORKER_LEASE_SECONDS: '2',
    WORKER_HANDLER_TIMEOUT_MS: '100',
  });
  const store = new FakeStore();
  const logger = new StructuredLogger(config.workerId, 'test');
  const registry = new HandlerRegistry().registerJob('nexora.worker.smoke', async (context) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 500);
      context.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(context.signal.reason);
        },
        { once: true },
      );
    });
  });
  const runtime = new WorkerRuntime(config, store, registry, logger);

  await runtime.start();
  await new Promise((resolve) => setTimeout(resolve, 150));
  await runtime.stop();

  assert.deepEqual(store.completedJobIds, []);
  assert.deepEqual(store.failedJobIds, ['job-1']);
  assert.equal(runtime.snapshot().failed, 1);
});
