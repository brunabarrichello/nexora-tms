import assert from 'node:assert/strict';
import { createCipheriv, createHmac } from 'node:crypto';
import test from 'node:test';

import { createDefaultHandlerRegistry } from './handlers.js';
import { StructuredLogger } from './logger.js';
import type { DurableJobWorkItem } from './store.js';
import type { WebhookDeliveryPort, WebhookDeliveryTarget } from './webhook-delivery.js';

const deliveryId = '88000000-0000-4000-8000-000000000001';
const secretKey = Buffer.alloc(32, 7);
const encodedKey = secretKey.toString('base64');
const signingSecret = 'nexora-test-signing-secret';

function encryptSecret(secret: string) {
  const iv = Buffer.alloc(12, 3);
  const cipher = createCipheriv('aes-256-gcm', secretKey, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return {
    signing_secret_ciphertext: ciphertext.toString('base64'),
    signing_secret_iv: iv.toString('base64'),
    signing_secret_tag: cipher.getAuthTag().toString('base64'),
  };
}

function target(status: 'active' | 'paused' = 'active'): WebhookDeliveryTarget {
  return {
    delivery_id: deliveryId,
    tenant_id: '88000000-0000-4000-8000-000000000010',
    subscription_id: '88000000-0000-4000-8000-000000000011',
    integration_client_id: '88000000-0000-4000-8000-000000000012',
    subscription_status: status,
    client_status: 'active',
    endpoint_url: 'https://example.com/webhooks/nexora',
    ...encryptSecret(signingSecret),
    timeout_ms: 5000,
    event_id: '88000000-0000-4000-8000-000000000013',
    event_type: 'freight.transport_request.created',
    event_version: 1,
    occurred_at: new Date('2026-09-02T12:00:00.000Z'),
    event_payload: { transportRequestId: '88000000-0000-4000-8000-000000000014' },
    idempotency_key: 'webhook:subscription:event',
  };
}

function job(attempt = 1, maxAttempts = 3): DurableJobWorkItem {
  return {
    id: '88000000-0000-4000-8000-000000000020',
    tenant_id: '88000000-0000-4000-8000-000000000010',
    source_outbox_event_id: '88000000-0000-4000-8000-000000000013',
    job_type: 'integrations.webhook.deliver',
    payload: { deliveryId },
    attempt,
    max_attempts: maxAttempts,
    correlation_id: 'corr-56',
    request_id: 'req-56',
    idempotency_key: 'webhook:subscription:event',
  };
}

function handlerContext(item: DurableJobWorkItem) {
  return {
    tenantId: item.tenant_id,
    payload: item.payload,
    correlationId: item.correlation_id,
    requestId: item.request_id,
    idempotencyKey: item.idempotency_key,
    attempt: item.attempt,
    maxAttempts: item.max_attempts,
    signal: new AbortController().signal,
  };
}

test('webhook job signs a deterministic v1 envelope and preserves idempotency', async () => {
  const attempts: Array<Parameters<WebhookDeliveryPort['recordWebhookAttempt']>[0]> = [];
  let receivedBody = '';
  let receivedHeaders: Headers | undefined;
  const port: WebhookDeliveryPort = {
    getWebhookDelivery: async () => target(),
    recordWebhookAttempt: async (input) => {
      attempts.push(input);
      return true;
    },
  };
  const fetchFn: typeof fetch = async (_input, init) => {
    receivedBody = String(init?.body ?? '');
    receivedHeaders = new Headers(init?.headers);
    return new Response(null, { status: 204 });
  };
  const now = new Date('2026-09-02T12:05:00.000Z');
  const registry = createDefaultHandlerRegistry(new StructuredLogger('test-worker', 'test'), {
    port,
    integrationSecretKey: encodedKey,
    fetchFn,
    resolveHost: async () => ['93.184.216.34'],
    now: () => now,
  });
  const item = job();
  const handler = registry.resolveJob(item);

  await handler(handlerContext(item));

  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const expectedSignature = createHmac('sha256', signingSecret)
    .update(`${timestamp}.${receivedBody}`, 'utf8')
    .digest('hex');
  assert.equal(receivedHeaders?.get('x-nexora-webhook-signature'), `v1=${expectedSignature}`);
  assert.equal(receivedHeaders?.get('x-nexora-webhook-timestamp'), timestamp);
  assert.equal(receivedHeaders?.get('idempotency-key'), target().idempotency_key);
  assert.deepEqual(JSON.parse(receivedBody), {
    id: deliveryId,
    type: target().event_type,
    apiVersion: 'v1',
    createdAt: target().occurred_at.toISOString(),
    data: target().event_payload,
  });
  assert.deepEqual(attempts, [
    {
      deliveryId,
      attempt: 1,
      outcome: 'success',
      statusCode: 204,
      durationMs: attempts[0]?.durationMs ?? 0,
      errorMessage: null,
      terminal: true,
    },
  ]);
});

test('webhook failure is recorded and remains retryable before max attempts', async () => {
  const attempts: Array<Parameters<WebhookDeliveryPort['recordWebhookAttempt']>[0]> = [];
  const port: WebhookDeliveryPort = {
    getWebhookDelivery: async () => target(),
    recordWebhookAttempt: async (input) => {
      attempts.push(input);
      return true;
    },
  };
  const fetchFn: typeof fetch = async () => new Response('', { status: 503 });
  const registry = createDefaultHandlerRegistry(new StructuredLogger('test-worker', 'test'), {
    port,
    integrationSecretKey: encodedKey,
    fetchFn,
    resolveHost: async () => ['93.184.216.34'],
  });
  const item = job(1, 2);

  await assert.rejects(() => registry.resolveJob(item)(handlerContext(item)), /HTTP 503/);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0]?.outcome, 'failure');
  assert.equal(attempts[0]?.statusCode, 503);
  assert.equal(attempts[0]?.terminal, false);
});

test('inactive webhook is cancelled without outbound network access', async () => {
  let fetched = false;
  const attempts: Array<Parameters<WebhookDeliveryPort['recordWebhookAttempt']>[0]> = [];
  const port: WebhookDeliveryPort = {
    getWebhookDelivery: async () => target('paused'),
    recordWebhookAttempt: async (input) => {
      attempts.push(input);
      return true;
    },
  };
  const fetchFn: typeof fetch = async () => {
    fetched = true;
    return new Response(null, { status: 204 });
  };
  const registry = createDefaultHandlerRegistry(new StructuredLogger('test-worker', 'test'), {
    port,
    integrationSecretKey: encodedKey,
    fetchFn,
    resolveHost: async () => ['93.184.216.34'],
  });
  const item = job();

  await registry.resolveJob(item)(handlerContext(item));
  assert.equal(fetched, false);
  assert.equal(attempts[0]?.outcome, 'cancelled');
});
