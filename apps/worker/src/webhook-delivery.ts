import { createDecipheriv, createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import type { HandlerContext, WorkHandler } from './handlers.js';

export interface WebhookDeliveryTarget {
  readonly delivery_id: string;
  readonly tenant_id: string;
  readonly subscription_id: string;
  readonly integration_client_id: string;
  readonly subscription_status: string;
  readonly client_status: string;
  readonly endpoint_url: string;
  readonly signing_secret_ciphertext: string;
  readonly signing_secret_iv: string;
  readonly signing_secret_tag: string;
  readonly timeout_ms: number;
  readonly event_id: string;
  readonly event_type: string;
  readonly event_version: number;
  readonly occurred_at: Date;
  readonly event_payload: unknown;
  readonly idempotency_key: string;
}

export interface WebhookDeliveryPort {
  getWebhookDelivery(deliveryId: string): Promise<WebhookDeliveryTarget | null>;
  recordWebhookAttempt(input: {
    readonly deliveryId: string;
    readonly attempt: number;
    readonly outcome: 'success' | 'failure' | 'cancelled';
    readonly statusCode: number | null;
    readonly durationMs: number;
    readonly errorMessage: string | null;
    readonly terminal: boolean;
  }): Promise<boolean>;
}

export interface WebhookDeliveryDependencies {
  readonly port: WebhookDeliveryPort;
  readonly integrationSecretKey: string | undefined;
  readonly fetchFn?: typeof fetch;
  readonly resolveHost?: (hostname: string) => Promise<readonly string[]>;
  readonly now?: () => Date;
}

export function createWebhookDeliveryHandler(
  dependencies: WebhookDeliveryDependencies,
): WorkHandler {
  const fetchFn = dependencies.fetchFn ?? fetch;
  const resolveHost = dependencies.resolveHost ?? resolveHostAddresses;
  const now = dependencies.now ?? (() => new Date());

  return async (context: HandlerContext): Promise<void> => {
    context.signal.throwIfAborted();
    const deliveryId = requireDeliveryId(context.payload);
    const target = await dependencies.port.getWebhookDelivery(deliveryId);
    if (!target) {
      throw new Error('Webhook delivery target was not found');
    }

    if (target.subscription_status !== 'active' || target.client_status !== 'active') {
      await dependencies.port.recordWebhookAttempt({
        deliveryId,
        attempt: context.attempt,
        outcome: 'cancelled',
        statusCode: null,
        durationMs: 0,
        errorMessage: 'Webhook subscription or integration client is inactive',
        terminal: true,
      });
      return;
    }

    const endpoint = new URL(target.endpoint_url);
    await assertPublicDestination(endpoint, resolveHost);
    const secret = decryptSigningSecret(target, dependencies.integrationSecretKey);
    const timestamp = Math.floor(now().getTime() / 1000).toString();
    const body = JSON.stringify({
      id: target.delivery_id,
      type: target.event_type,
      apiVersion: 'v1',
      createdAt: target.occurred_at.toISOString(),
      data: target.event_payload,
    });
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`, 'utf8')
      .digest('hex');
    const startedAt = Date.now();

    try {
      const response = await fetchFn(endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Nexora-TMS-Webhook/1.0',
          'x-nexora-webhook-id': target.delivery_id,
          'x-nexora-webhook-event': target.event_type,
          'x-nexora-webhook-timestamp': timestamp,
          'x-nexora-webhook-signature': `v1=${signature}`,
          'idempotency-key': target.idempotency_key,
        },
        body,
        signal: AbortSignal.any([context.signal, AbortSignal.timeout(target.timeout_ms)]),
      });
      const durationMs = Math.max(0, Date.now() - startedAt);
      if (!response.ok) {
        const message = `Webhook endpoint returned HTTP ${response.status}`;
        await dependencies.port.recordWebhookAttempt({
          deliveryId,
          attempt: context.attempt,
          outcome: 'failure',
          statusCode: response.status,
          durationMs,
          errorMessage: message,
          terminal: context.attempt >= context.maxAttempts,
        });
        throw new Error(message);
      }

      await dependencies.port.recordWebhookAttempt({
        deliveryId,
        attempt: context.attempt,
        outcome: 'success',
        statusCode: response.status,
        durationMs,
        errorMessage: null,
        terminal: true,
      });
    } catch (error) {
      if (error instanceof Error && /^Webhook endpoint returned HTTP /.test(error.message)) {
        throw error;
      }
      const durationMs = Math.max(0, Date.now() - startedAt);
      const message = error instanceof Error ? error.message : 'Webhook delivery failed';
      await dependencies.port.recordWebhookAttempt({
        deliveryId,
        attempt: context.attempt,
        outcome: 'failure',
        statusCode: null,
        durationMs,
        errorMessage: message,
        terminal: context.attempt >= context.maxAttempts,
      });
      throw error instanceof Error ? error : new Error(message);
    }
  };
}

export function decryptSigningSecret(
  target: Pick<
    WebhookDeliveryTarget,
    'signing_secret_ciphertext' | 'signing_secret_iv' | 'signing_secret_tag'
  >,
  encodedKey: string | undefined,
): string {
  if (!encodedKey) throw new Error('NEXORA_INTEGRATION_SECRET_KEY is not configured');
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) {
    throw new Error('NEXORA_INTEGRATION_SECRET_KEY must decode to 32 bytes');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(target.signing_secret_iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(target.signing_secret_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(target.signing_secret_ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

async function assertPublicDestination(
  endpoint: URL,
  resolveHost: (hostname: string) => Promise<readonly string[]>,
): Promise<void> {
  if (endpoint.protocol !== 'https:' || (endpoint.port !== '' && endpoint.port !== '443')) {
    throw new Error('Webhook endpoint must use HTTPS on the default TLS port');
  }
  const addresses = await resolveHost(endpoint.hostname);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error('Webhook endpoint resolved to a local or private network address');
  }
}

async function resolveHostAddresses(hostname: string): Promise<readonly string[]> {
  if (isIP(hostname)) return [hostname];
  const result = await lookup(hostname, { all: true, verbatim: true });
  return result.map((entry) => entry.address);
}

function isPrivateAddress(address: string): boolean {
  if (address.includes(':')) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('::ffff:10.') ||
      normalized.startsWith('::ffff:127.') ||
      normalized.startsWith('::ffff:192.168.')
    );
  }
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function requireDeliveryId(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Webhook delivery job payload must be an object');
  }
  const deliveryId = (payload as Record<string, unknown>).deliveryId;
  if (
    typeof deliveryId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deliveryId)
  ) {
    throw new Error('Webhook delivery job payload must include a valid deliveryId');
  }
  return deliveryId.toLowerCase();
}
