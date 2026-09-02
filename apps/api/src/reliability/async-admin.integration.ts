import assert from 'node:assert/strict';

import { Pool } from 'pg';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { AsyncAdminService } from './async-admin.service.js';

const TENANT_A = '78000000-0000-4000-8000-000000000001';
const TENANT_B = '78000000-0000-4000-8000-000000000002';
const ADMIN_A = '78000000-0000-4000-8000-000000000101';
const OPERATIONS_A = '78000000-0000-4000-8000-000000000102';
const ADMIN_B = '78000000-0000-4000-8000-000000000201';
const OUTBOX_ID = '78000000-0000-4000-8000-000000000501';
const JOB_ID = '78000000-0000-4000-8000-000000000601';
const OUTBOX_KEY = 'nex55:outbox:notification-001';
const JOB_KEY = 'nex55:job:smoke-001';
const WORKER_ID = 'nex55-integration-worker';

function context(subject: string, tenantId: string, userId: string): TenantContext {
  const value = new TenantContext();
  value.establish({ subject, tenantId, userId });
  return value;
}

async function run(): Promise<void> {
  const workerDatabaseUrl = process.env.WORKER_DATABASE_URL;
  if (!workerDatabaseUrl) throw new Error('WORKER_DATABASE_URL is required');

  const database = new TenantDatabaseService();
  const worker = new Pool({ connectionString: workerDatabaseUrl, max: 2 });
  const admin = new AsyncAdminService(context('integration|nex55-admin-a', TENANT_A, ADMIN_A), database);
  const operations = new AsyncAdminService(
    context('integration|nex55-operations-a', TENANT_A, OPERATIONS_A),
    database,
  );
  const otherTenant = new AsyncAdminService(
    context('integration|nex55-admin-b', TENANT_B, ADMIN_B),
    database,
  );

  try {
    const identity = await worker.query<{ role: string }>('SELECT current_user AS role');
    assert.equal(identity.rows[0]?.role, 'nexora_worker');

    const initialOutbox = await admin.listOutbox({ state: 'pending' });
    const initialEvent = initialOutbox.find((item) => item.id === OUTBOX_ID);
    assert.ok(initialEvent);
    assert.equal(initialEvent.idempotencyKey, OUTBOX_KEY);
    assert.equal(initialEvent.attempts, 0);
    assert.equal((await otherTenant.listOutbox({ state: 'pending' })).some((item) => item.id === OUTBOX_ID), false);

    const firstOutboxClaim = await claimOutbox(worker, OUTBOX_ID);
    assert.equal(firstOutboxClaim.attempts, 1);
    assert.equal(await failOutbox(worker, OUTBOX_ID, 'synthetic first notification failure'), 'retry_wait');

    const retryOutbox = (await admin.listOutbox({ state: 'retry_wait' })).find(
      (item) => item.id === OUTBOX_ID,
    );
    assert.ok(retryOutbox);
    assert.equal(retryOutbox.idempotencyKey, OUTBOX_KEY);
    assert.match(retryOutbox.lastError ?? '', /synthetic first notification failure/);

    await delay(1_200);
    const secondOutboxClaim = await claimOutbox(worker, OUTBOX_ID);
    assert.equal(secondOutboxClaim.attempts, 2);
    assert.equal(await failOutbox(worker, OUTBOX_ID, 'synthetic terminal notification failure'), 'dead_lettered');

    const deadOutbox = (await admin.listOutbox({ state: 'dead_lettered' })).find(
      (item) => item.id === OUTBOX_ID,
    );
    assert.ok(deadOutbox);
    assert.equal(deadOutbox.attempts, 2);
    assert.equal(deadOutbox.idempotencyKey, OUTBOX_KEY);
    assert.match(deadOutbox.deadLetterReason ?? '', /synthetic terminal notification failure/);

    await assert.rejects(
      () => operations.reprocessOutbox(OUTBOX_ID, { reason: 'Tentativa sem privilégio' }),
      /Tenant admin permission is required/,
    );
    await assert.rejects(
      () => otherTenant.reprocessOutbox(OUTBOX_ID, { reason: 'Tentativa cross-tenant' }),
      /not found in current tenant/i,
    );

    const outboxReprocess = await admin.reprocessOutbox(OUTBOX_ID, {
      reason: 'Falha sintética corrigida para qualificação NEX-55',
    });
    assert.equal(outboxReprocess.requeued, true);

    const requeuedOutbox = (await admin.listOutbox({ state: 'pending' })).find(
      (item) => item.id === OUTBOX_ID,
    );
    assert.ok(requeuedOutbox);
    assert.equal(requeuedOutbox.attempts, 0);
    assert.equal(requeuedOutbox.idempotencyKey, OUTBOX_KEY);
    assert.equal(requeuedOutbox.lastError, null);

    const successOutboxClaim = await claimOutbox(worker, OUTBOX_ID);
    assert.equal(successOutboxClaim.attempts, 1);
    assert.equal(await completeOutbox(worker, OUTBOX_ID), true);

    const processedOutbox = (await admin.listOutbox({ state: 'processed' })).find(
      (item) => item.id === OUTBOX_ID,
    );
    assert.ok(processedOutbox);
    assert.equal(processedOutbox.idempotencyKey, OUTBOX_KEY);
    assert.equal(processedOutbox.attempts, 1);
    assert.ok(processedOutbox.processedAt);

    const initialJobs = await admin.listJobs({ state: 'pending' });
    const initialJob = initialJobs.find((item) => item.id === JOB_ID);
    assert.ok(initialJob);
    assert.equal(initialJob.idempotencyKey, JOB_KEY);

    const firstJobClaim = await claimJob(worker, JOB_ID);
    assert.equal(firstJobClaim.attempt, 1);
    assert.equal(await failJob(worker, JOB_ID, 'synthetic first job failure'), 'retry_wait');
    await delay(1_200);
    const secondJobClaim = await claimJob(worker, JOB_ID);
    assert.equal(secondJobClaim.attempt, 2);
    assert.equal(await failJob(worker, JOB_ID, 'synthetic terminal job failure'), 'dead_lettered');

    const deadJob = (await admin.listJobs({ state: 'dead_lettered' })).find(
      (item) => item.id === JOB_ID,
    );
    assert.ok(deadJob);
    assert.equal(deadJob.attempt, 2);
    assert.equal(deadJob.idempotencyKey, JOB_KEY);

    await assert.rejects(
      () => operations.reprocessJob(JOB_ID, { reason: 'Tentativa sem privilégio' }),
      /Tenant admin permission is required/,
    );

    const jobReprocess = await admin.reprocessJob(JOB_ID, {
      reason: 'Falha sintética do job corrigida para qualificação NEX-55',
    });
    assert.equal(jobReprocess.requeued, true);

    const requeuedJob = (await admin.listJobs({ state: 'retry_wait' })).find(
      (item) => item.id === JOB_ID,
    );
    assert.ok(requeuedJob);
    assert.equal(requeuedJob.attempt, 0);
    assert.equal(requeuedJob.idempotencyKey, JOB_KEY);

    const successJobClaim = await claimJob(worker, JOB_ID);
    assert.equal(successJobClaim.attempt, 1);
    assert.equal(await completeJob(worker, JOB_ID), true);

    const succeededJob = (await admin.listJobs({ state: 'succeeded' })).find(
      (item) => item.id === JOB_ID,
    );
    assert.ok(succeededJob);
    assert.equal(succeededJob.idempotencyKey, JOB_KEY);
    assert.equal(succeededJob.attempt, 1);
  } finally {
    await worker.end();
    await database.onModuleDestroy();
  }
}

async function claimOutbox(pool: Pool, id: string): Promise<{ attempts: number }> {
  const result = await pool.query<{ id: string; attempts: number }>(
    'SELECT id::text AS id,attempts FROM nexora_claim_outbox_events($1,500,30)',
    [WORKER_ID],
  );
  const item = result.rows.find((row) => row.id === id);
  assert.ok(item, `expected outbox event ${id} to be claimable`);
  return item;
}

async function failOutbox(pool: Pool, id: string, message: string): Promise<string | null> {
  const result = await pool.query<{ status: string | null }>(
    'SELECT nexora_fail_outbox_event($1::uuid,$2,$3,1,1) AS status',
    [id, WORKER_ID, message],
  );
  return result.rows[0]?.status ?? null;
}

async function completeOutbox(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query<{ completed: boolean }>(
    'SELECT nexora_complete_outbox_event($1::uuid,$2) AS completed',
    [id, WORKER_ID],
  );
  return result.rows[0]?.completed === true;
}

async function claimJob(pool: Pool, id: string): Promise<{ attempt: number }> {
  const result = await pool.query<{ id: string; attempt: number }>(
    'SELECT id::text AS id,attempt FROM nexora_claim_durable_jobs($1,500,30)',
    [WORKER_ID],
  );
  const item = result.rows.find((row) => row.id === id);
  assert.ok(item, `expected durable job ${id} to be claimable`);
  return item;
}

async function failJob(pool: Pool, id: string, message: string): Promise<string | null> {
  const result = await pool.query<{ status: string | null }>(
    'SELECT nexora_fail_durable_job($1::uuid,$2,$3,1,1) AS status',
    [id, WORKER_ID, message],
  );
  return result.rows[0]?.status ?? null;
}

async function completeJob(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query<{ completed: boolean }>(
    'SELECT nexora_complete_durable_job($1::uuid,$2) AS completed',
    [id, WORKER_ID],
  );
  return result.rows[0]?.completed === true;
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
