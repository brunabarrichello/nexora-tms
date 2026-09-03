import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  CommunicationProviderRegistry,
  createCommunicationDeliveryHandler,
  DeterministicCommunicationProvider,
  type CommunicationDeliveryPort,
  type CommunicationDeliveryTarget,
  type CommunicationProvider,
} from './communication-delivery.js';
import type { HandlerContext } from './handlers.js';

const communicationId = '77000000-0000-4000-8000-000000000701';

function target(overrides: Partial<CommunicationDeliveryTarget> = {}): CommunicationDeliveryTarget {
  return {
    communication_id: communicationId,
    tenant_id: '77000000-0000-4000-8000-000000000001',
    communication_status: 'queued',
    route_status: 'active',
    provider_code: 'deterministic',
    channel: 'whatsapp',
    destination: '+5511999999999',
    rendered_subject: null,
    rendered_body: 'Trip TRIP-123 started',
    idempotency_key: 'trip-123-driver-started',
    ...overrides,
  };
}

function context(attempt = 1, maxAttempts = 3): HandlerContext {
  return {
    tenantId: '77000000-0000-4000-8000-000000000001',
    payload: { communicationId },
    correlationId: null,
    requestId: null,
    idempotencyKey: 'communication-job',
    attempt,
    maxAttempts,
    signal: new AbortController().signal,
  };
}

function fakePort(
  deliveryTarget: CommunicationDeliveryTarget,
): CommunicationDeliveryPort & { attempts: Array<Record<string, unknown>> } {
  const attempts: Array<Record<string, unknown>> = [];
  return {
    attempts,
    async getCommunicationDelivery() {
      return deliveryTarget;
    },
    async recordCommunicationAttempt(input) {
      attempts.push({ ...input });
      return true;
    },
  };
}

test('deterministic provider succeeds without external credentials and records provider id', async () => {
  const port = fakePort(target());
  const providers = new CommunicationProviderRegistry().register(
    new DeterministicCommunicationProvider(),
  );
  await createCommunicationDeliveryHandler({ port, providers })(context());
  assert.equal(port.attempts.length, 1);
  assert.equal(port.attempts[0]?.outcome, 'success');
  assert.match(String(port.attempts[0]?.providerMessageId), /^det-/);
  assert.equal(port.attempts[0]?.statusCode, 202);
});

test('provider failure records retryable error before rethrowing to durable runtime', async () => {
  const port = fakePort(target({ provider_code: 'failing' }));
  const provider: CommunicationProvider = {
    code: 'failing',
    channels: ['whatsapp'],
    async send() {
      throw new Error('provider timeout');
    },
  };
  const providers = new CommunicationProviderRegistry().register(provider);
  await assert.rejects(
    createCommunicationDeliveryHandler({ port, providers })(context(1, 3)),
    /provider timeout/,
  );
  assert.equal(port.attempts[0]?.outcome, 'failure');
  assert.equal(port.attempts[0]?.terminal, false);
});

test('final provider failure is recorded as terminal', async () => {
  const port = fakePort(target({ provider_code: 'failing' }));
  const provider: CommunicationProvider = {
    code: 'failing',
    channels: ['whatsapp'],
    async send() {
      throw new Error('provider unavailable');
    },
  };
  const providers = new CommunicationProviderRegistry().register(provider);
  await assert.rejects(
    createCommunicationDeliveryHandler({ port, providers })(context(3, 3)),
    /provider unavailable/,
  );
  assert.equal(port.attempts[0]?.terminal, true);
});

test('missing provider is auditable and participates in retry lifecycle', async () => {
  const port = fakePort(target({ provider_code: 'missing' }));
  await assert.rejects(
    createCommunicationDeliveryHandler({ port, providers: new CommunicationProviderRegistry() })(
      context(1, 3),
    ),
    /not registered/,
  );
  assert.equal(port.attempts[0]?.outcome, 'failure');
  assert.match(String(port.attempts[0]?.errorMessage), /not registered/);
});

test('disabled provider route cancels communication without invoking provider', async () => {
  const port = fakePort(target({ route_status: 'disabled' }));
  await createCommunicationDeliveryHandler({
    port,
    providers: new CommunicationProviderRegistry(),
  })(context());
  assert.equal(port.attempts[0]?.outcome, 'cancelled');
  assert.equal(port.attempts[0]?.terminal, true);
});
