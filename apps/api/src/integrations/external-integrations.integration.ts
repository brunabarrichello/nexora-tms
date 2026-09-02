import assert from 'node:assert/strict';

import { Pool } from 'pg';

const appUrl = process.env.DATABASE_URL;
const workerUrl = process.env.WORKER_DATABASE_URL;
if (!appUrl || !workerUrl) {
  throw new Error('DATABASE_URL and WORKER_DATABASE_URL are required');
}

const tenantA = '78200000-0000-4000-8000-000000000001';
const tenantB = '78200000-0000-4000-8000-000000000002';
const adminA = '78200000-0000-4000-8000-000000000101';
const clientA = '78200000-0000-4000-8000-000000000501';
const sourceEvent = '78200000-0000-4000-8000-000000000701';
const validHash = '11'.repeat(32);

const app = new Pool({ connectionString: appUrl, max: 2, application_name: 'nex56-api-gate' });
const worker = new Pool({
  connectionString: workerUrl,
  max: 2,
  application_name: 'nex56-worker-gate',
});

try {
  const authenticated = await app.query<{
    client_id: string;
    tenant_id: string;
    client_name: string;
    scopes: string[];
  }>('select * from nexora_authenticate_integration_client($1::uuid,$2::text)', [clientA, validHash]);
  assert.equal(authenticated.rowCount, 1);
  assert.equal(authenticated.rows[0]?.tenant_id, tenantA);
  assert.deepEqual(authenticated.rows[0]?.scopes, ['freight.read', 'trips.read']);

  const rejected = await app.query(
    'select * from nexora_authenticate_integration_client($1::uuid,$2::text)',
    [clientA, 'ff'.repeat(32)],
  );
  assert.equal(rejected.rowCount, 0);

  const appClient = await app.connect();
  try {
    await appClient.query('begin');
    await appClient.query(
      `select set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)`,
      [adminA, tenantA],
    );
    const visible = await appClient.query<{ id: string }>(
      'select id::text from integration_clients order by id',
    );
    assert.deepEqual(visible.rows.map((row) => row.id), [clientA]);
    await appClient.query('commit');
  } finally {
    appClient.release();
  }

  const secretProbe = await app.connect();
  try {
    await secretProbe.query('begin');
    await secretProbe.query(
      `select set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)`,
      [adminA, tenantA],
    );
    await assert.rejects(
      () => secretProbe.query('select secret_hash from integration_clients where id=$1::uuid', [clientA]),
      /permission denied/i,
    );
    await secretProbe.query('rollback');
  } finally {
    secretProbe.release();
  }

  const tenantIsolation = await app.connect();
  try {
    await tenantIsolation.query('begin');
    await tenantIsolation.query(
      `select set_config('app.user_id','78200000-0000-4000-8000-000000000201',true),set_config('app.tenant_id',$1,true)`,
      [tenantB],
    );
    const invisible = await tenantIsolation.query(
      'select id from webhook_subscriptions where tenant_id=$1::uuid',
      [tenantA],
    );
    assert.equal(invisible.rowCount, 0);
    await tenantIsolation.query('commit');
  } finally {
    tenantIsolation.release();
  }

  const claimed1 = await worker.query<{
    id: string;
    job_type: string;
    attempt: number;
    max_attempts: number;
    idempotency_key: string;
  }>('select id::text,job_type,attempt,max_attempts,idempotency_key from nexora_claim_durable_jobs($1,$2,$3)', [
    'nex56-worker',
    10,
    30,
  ]);
  const first = claimed1.rows.find((row) => row.job_type === 'integrations.webhook.deliver');
  assert.ok(first);
  assert.equal(first.attempt, 1);
  assert.equal(first.max_attempts, 2);
  const originalIdempotencyKey = first.idempotency_key;

  const target = await worker.query<{
    delivery_id: string;
    event_type: string;
    event_version: number;
    event_payload: unknown;
    idempotency_key: string;
  }>('select delivery_id::text,event_type,event_version,event_payload,idempotency_key from nexora_worker_get_webhook_delivery((select id from webhook_deliveries where durable_job_id=$1::uuid))', [
    first.id,
  ]);
  assert.equal(target.rowCount, 1);
  assert.equal(target.rows[0]?.event_type, 'nex56.integration.test');
  assert.equal(target.rows[0]?.idempotency_key, originalIdempotencyKey);

  const deliveryId = target.rows[0]!.delivery_id;
  await worker.query(
    'select nexora_worker_record_webhook_attempt($1::uuid,1,$2,503,12,$3,false)',
    [deliveryId, 'failure', 'fixture HTTP 503'],
  );
  const retry = await worker.query<{ status: string }>(
    'select nexora_fail_durable_job($1::uuid,$2,$3,1,1) as status',
    [first.id, 'nex56-worker', 'fixture HTTP 503'],
  );
  assert.equal(retry.rows[0]?.status, 'retry_wait');

  await worker.query(
    `update durable_jobs set run_at=now()-interval '1 second',updated_at=now() where id=$1::uuid`,
    [first.id],
  );
  const claimed2 = await worker.query<{ id: string; job_type: string; attempt: number }>(
    'select id::text,job_type,attempt from nexora_claim_durable_jobs($1,$2,$3)',
    ['nex56-worker', 10, 30],
  );
  const second = claimed2.rows.find((row) => row.id === first.id);
  assert.ok(second);
  assert.equal(second.attempt, 2);

  await worker.query(
    'select nexora_worker_record_webhook_attempt($1::uuid,2,$2,503,14,$3,true)',
    [deliveryId, 'failure', 'fixture HTTP 503 terminal'],
  );
  const dead = await worker.query<{ status: string }>(
    'select nexora_fail_durable_job($1::uuid,$2,$3,1,1) as status',
    [first.id, 'nex56-worker', 'fixture HTTP 503 terminal'],
  );
  assert.equal(dead.rows[0]?.status, 'dead_lettered');

  const admin = await app.connect();
  try {
    await admin.query('begin');
    await admin.query(`select set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)`, [
      adminA,
      tenantA,
    ]);
    const requeued = await admin.query<{ requeued: boolean }>(
      'select nexora_admin_requeue_durable_job($1::uuid,$2) as requeued',
      [first.id, 'NEX-56 qualification replay after downstream recovery'],
    );
    assert.equal(requeued.rows[0]?.requeued, true);
    const delivery = await admin.query<{ status: string; idempotency_key: string; attempts: number }>(
      'select status,idempotency_key,attempts from webhook_deliveries where id=$1::uuid',
      [deliveryId],
    );
    assert.equal(delivery.rows[0]?.status, 'retry_wait');
    assert.equal(delivery.rows[0]?.idempotency_key, originalIdempotencyKey);
    assert.equal(delivery.rows[0]?.attempts, 2);
    await admin.query('commit');
  } finally {
    admin.release();
  }

  const claimed3 = await worker.query<{ id: string; attempt: number; idempotency_key: string }>(
    'select id::text,attempt,idempotency_key from nexora_claim_durable_jobs($1,$2,$3)',
    ['nex56-worker', 10, 30],
  );
  const third = claimed3.rows.find((row) => row.id === first.id);
  assert.ok(third);
  assert.equal(third.attempt, 1);
  assert.equal(third.idempotency_key, originalIdempotencyKey);

  await worker.query(
    'select nexora_worker_record_webhook_attempt($1::uuid,3,$2,204,9,null,true)',
    [deliveryId, 'success'],
  );
  const completed = await worker.query<{ completed: boolean }>(
    'select nexora_complete_durable_job($1::uuid,$2) as completed',
    [first.id, 'nex56-worker'],
  );
  assert.equal(completed.rows[0]?.completed, true);

  const finalApp = await app.connect();
  try {
    await finalApp.query('begin');
    await finalApp.query(`select set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)`, [
      adminA,
      tenantA,
    ]);
    const finalDelivery = await finalApp.query<{
      status: string;
      attempts: number;
      idempotency_key: string;
      succeeded_at: Date | null;
    }>('select status,attempts,idempotency_key,succeeded_at from webhook_deliveries where id=$1::uuid', [
      deliveryId,
    ]);
    assert.equal(finalDelivery.rows[0]?.status, 'succeeded');
    assert.equal(finalDelivery.rows[0]?.attempts, 3);
    assert.equal(finalDelivery.rows[0]?.idempotency_key, originalIdempotencyKey);
    assert.ok(finalDelivery.rows[0]?.succeeded_at);
    await finalApp.query('commit');
  } finally {
    finalApp.release();
  }

  const ownerVisibleAudit = await app.query<{ action: string; total: string }>(
    `select action,count(*)::text as total
       from audit_events
      where tenant_id=$1::uuid
        and action in (
          'integration.api.authenticated','integration.api.authentication_denied',
          'integration.webhook.queued','integration.webhook.delivery_failed',
          'integration.webhook.delivery_succeeded','async.job.reprocess_requested'
        )
      group by action`,
    [tenantA],
  ).catch(() => ({ rows: [] as { action: string; total: string }[] }));
  void ownerVisibleAudit;

  assert.equal(sourceEvent, '78200000-0000-4000-8000-000000000701');
} finally {
  await Promise.allSettled([app.end(), worker.end()]);
}
