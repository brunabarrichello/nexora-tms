import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultHandlerRegistry } from './handlers.js';
import { StructuredLogger } from './logger.js';
import type { OutboxWorkItem } from './store.js';

const notificationTypes = [
  'freight.transport_request.created',
  'negotiation.transport_contract.confirmed',
  'trips.status.changed',
  'documents.validation.recorded',
] as const;

function item(eventType: string): OutboxWorkItem {
  return {
    id: 'event-1',
    tenant_id: 'tenant-1',
    aggregate_type: 'transport_request',
    aggregate_id: 'aggregate-1',
    event_type: eventType,
    event_version: 1,
    payload: {
      channel: 'in_app',
      module: 'freight',
      contextUrl: '/cargas',
    },
    attempts: 1,
    max_attempts: 10,
    correlation_id: 'corr-1',
    request_id: 'req-1',
    idempotency_key: `in-app:${eventType}:aggregate-1`,
  };
}

function context(payload: unknown) {
  return {
    tenantId: 'tenant-1',
    payload,
    correlationId: 'corr-1',
    requestId: 'req-1',
    idempotencyKey: 'in-app:test',
    attempt: 1,
    maxAttempts: 10,
    signal: new AbortController().signal,
  };
}

test('default registry handles every NEX-54 in-app outbox event', async () => {
  const registry = createDefaultHandlerRegistry(new StructuredLogger('test-worker', 'test'));

  for (const eventType of notificationTypes) {
    const handler = registry.resolveOutbox(item(eventType));
    await assert.doesNotReject(() => handler(context(item(eventType).payload)));
  }
});

test('notification handler rejects malformed channel instead of silently completing', async () => {
  const registry = createDefaultHandlerRegistry(new StructuredLogger('test-worker', 'test'));
  const handler = registry.resolveOutbox(item(notificationTypes[0]));

  await assert.rejects(
    () => handler(context({ channel: 'email', module: 'freight', contextUrl: '/cargas' })),
    /channel=in_app/,
  );
});
