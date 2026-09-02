import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { QueryResult } from 'pg';

import type { TenantQueryClient } from '../tenancy/tenant-database.service.js';
import { appendOutboxEvent, enqueueDurableJob } from './transactional-async.js';

interface CapturedQuery {
  readonly text: string;
  readonly values: readonly unknown[];
}

function fakeClient(returnedId: string, captured: CapturedQuery[]): TenantQueryClient {
  return {
    query: async (text: string, values?: readonly unknown[]) => {
      captured.push({ text, values: values ?? [] });
      return {
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
        rows: [{ id: returnedId }],
      } as QueryResult<{ id: string }>;
    },
  } as unknown as TenantQueryClient;
}

test('appendOutboxEvent uses the caller transaction without BEGIN or COMMIT', async () => {
  const captured: CapturedQuery[] = [];
  const id = await appendOutboxEvent(fakeClient('event-1', captured), {
    tenantId: '79000000-0000-4000-8000-000000000001',
    aggregateType: ' trip ',
    aggregateId: 'trip-1',
    eventType: 'trip.created',
    payload: { tripId: 'trip-1' },
    idempotencyKey: 'trip.created:trip-1:v1',
    correlationId: 'corr-1',
  });

  assert.equal(id, 'event-1');
  assert.equal(captured.length, 1);
  assert.match(captured[0]?.text ?? '', /INSERT INTO outbox_events/);
  assert.doesNotMatch(captured[0]?.text ?? '', /\bBEGIN\b|\bCOMMIT\b/i);
  assert.equal(captured[0]?.values[1], 'trip');
  assert.equal(captured[0]?.values[5], JSON.stringify({ tripId: 'trip-1' }));
  assert.equal(captured[0]?.values[6], 'trip.created:trip-1:v1');
});

test('enqueueDurableJob keeps source event and idempotency metadata in one insert', async () => {
  const captured: CapturedQuery[] = [];
  const id = await enqueueDurableJob(fakeClient('job-1', captured), {
    tenantId: '79000000-0000-4000-8000-000000000001',
    sourceOutboxEventId: '79000000-0000-4000-8000-000000000101',
    jobType: 'trip.created.dispatch',
    payload: { tripId: 'trip-1' },
    idempotencyKey: 'dispatch:trip-1:v1',
    requestId: 'req-1',
  });

  assert.equal(id, 'job-1');
  assert.equal(captured.length, 1);
  assert.match(captured[0]?.text ?? '', /INSERT INTO durable_jobs/);
  assert.doesNotMatch(captured[0]?.text ?? '', /\bBEGIN\b|\bCOMMIT\b/i);
  assert.equal(captured[0]?.values[1], '79000000-0000-4000-8000-000000000101');
  assert.equal(captured[0]?.values[4], 'dispatch:trip-1:v1');
});

test('transaction-bound helpers reject empty routing keys before querying PostgreSQL', async () => {
  const captured: CapturedQuery[] = [];
  const client = fakeClient('unused', captured);

  await assert.rejects(
    appendOutboxEvent(client, {
      tenantId: '79000000-0000-4000-8000-000000000001',
      aggregateType: ' ',
      aggregateId: 'trip-1',
      eventType: 'trip.created',
      payload: {},
      idempotencyKey: 'key-1',
    }),
    /aggregateType must not be empty/,
  );

  assert.equal(captured.length, 0);
});

test('transaction-bound helpers reject invalid attempt limits before querying PostgreSQL', async () => {
  const captured: CapturedQuery[] = [];
  const client = fakeClient('unused', captured);

  await assert.rejects(
    enqueueDurableJob(client, {
      tenantId: '79000000-0000-4000-8000-000000000001',
      jobType: 'trip.created.dispatch',
      payload: {},
      idempotencyKey: 'key-1',
      maxAttempts: 0,
    }),
    /maxAttempts must be a positive integer/,
  );

  assert.equal(captured.length, 0);
});
