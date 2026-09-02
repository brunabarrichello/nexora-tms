import { BadRequestException } from '@nestjs/common';

export const EXTERNAL_INTEGRATION_SCOPES = [
  'freight.read',
  'trips.read',
  'documents.read',
] as const;

export type ExternalIntegrationScope = (typeof EXTERNAL_INTEGRATION_SCOPES)[number];

export interface CreateIntegrationClientInput {
  readonly name: string;
  readonly scopes: readonly ExternalIntegrationScope[];
  readonly expiresAt: string | null;
}

export interface CreateWebhookSubscriptionInput {
  readonly integrationClientId: string;
  readonly name: string;
  readonly endpointUrl: string;
  readonly eventTypes: readonly string[];
  readonly maxAttempts: number;
  readonly timeoutMs: number;
}

export interface UpdateWebhookSubscriptionInput {
  readonly name?: string;
  readonly endpointUrl?: string;
  readonly eventTypes?: readonly string[];
  readonly maxAttempts?: number;
  readonly timeoutMs?: number;
  readonly status?: 'active' | 'paused' | 'revoked';
  readonly reason?: string;
}

export function parseCreateIntegrationClient(body: unknown): CreateIntegrationClientInput {
  const record = requireObject(body);
  const name = requireText(record.name, 'name', 1, 160);
  if (!Array.isArray(record.scopes) || record.scopes.length < 1 || record.scopes.length > 8) {
    throw new BadRequestException('scopes must contain between 1 and 8 values');
  }
  const scopes = [...new Set(record.scopes.map((scope) => requireScope(scope)))];
  if (scopes.length !== record.scopes.length) {
    throw new BadRequestException('scopes must not contain duplicates');
  }

  let expiresAt: string | null = null;
  if (record.expiresAt !== undefined && record.expiresAt !== null && record.expiresAt !== '') {
    if (typeof record.expiresAt !== 'string') {
      throw new BadRequestException('expiresAt must be an ISO-8601 datetime');
    }
    const parsed = new Date(record.expiresAt);
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      throw new BadRequestException('expiresAt must be a valid future datetime');
    }
    expiresAt = parsed.toISOString();
  }

  return { name, scopes, expiresAt };
}

export function parseCreateWebhookSubscription(body: unknown): CreateWebhookSubscriptionInput {
  const record = requireObject(body);
  return {
    integrationClientId: requireUuid(record.integrationClientId, 'integrationClientId'),
    name: requireText(record.name, 'name', 1, 160),
    endpointUrl: requireWebhookEndpoint(record.endpointUrl),
    eventTypes: requireEventTypes(record.eventTypes),
    maxAttempts: requireInteger(record.maxAttempts ?? 5, 'maxAttempts', 1, 10),
    timeoutMs: requireInteger(record.timeoutMs ?? 5000, 'timeoutMs', 500, 15000),
  };
}

export function parseUpdateWebhookSubscription(body: unknown): UpdateWebhookSubscriptionInput {
  const record = requireObject(body);
  const result: {
    name?: string;
    endpointUrl?: string;
    eventTypes?: readonly string[];
    maxAttempts?: number;
    timeoutMs?: number;
    status?: 'active' | 'paused' | 'revoked';
    reason?: string;
  } = {};

  if (record.name !== undefined) result.name = requireText(record.name, 'name', 1, 160);
  if (record.endpointUrl !== undefined)
    result.endpointUrl = requireWebhookEndpoint(record.endpointUrl);
  if (record.eventTypes !== undefined) result.eventTypes = requireEventTypes(record.eventTypes);
  if (record.maxAttempts !== undefined) {
    result.maxAttempts = requireInteger(record.maxAttempts, 'maxAttempts', 1, 10);
  }
  if (record.timeoutMs !== undefined) {
    result.timeoutMs = requireInteger(record.timeoutMs, 'timeoutMs', 500, 15000);
  }
  if (record.status !== undefined) {
    if (record.status !== 'active' && record.status !== 'paused' && record.status !== 'revoked') {
      throw new BadRequestException('status must be active, paused, or revoked');
    }
    result.status = record.status;
  }
  if (record.reason !== undefined) result.reason = requireText(record.reason, 'reason', 3, 1000);
  if (result.status === 'revoked' && !result.reason) {
    throw new BadRequestException('reason is required when revoking a webhook subscription');
  }
  if (Object.keys(result).length === 0) {
    throw new BadRequestException('webhook update requires at least one field');
  }
  return result;
}

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a UUID`);
  const normalized = value.trim().toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
  ) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return normalized;
}

export function parseLimit(value: string | undefined): number {
  if (!value) return 100;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 200) {
    throw new BadRequestException('limit must be an integer between 1 and 200');
  }
  return parsed;
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('body must be an object');
  }
  return value as Record<string, unknown>;
}

function requireText(value: unknown, field: string, minLength: number, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new BadRequestException(
      `${field} must contain between ${minLength} and ${maxLength} characters`,
    );
  }
  return normalized;
}

function requireScope(value: unknown): ExternalIntegrationScope {
  if (
    typeof value !== 'string' ||
    !EXTERNAL_INTEGRATION_SCOPES.includes(value as ExternalIntegrationScope)
  ) {
    throw new BadRequestException(
      `scope must be one of: ${EXTERNAL_INTEGRATION_SCOPES.join(', ')}`,
    );
  }
  return value as ExternalIntegrationScope;
}

function requireEventTypes(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    throw new BadRequestException('eventTypes must contain between 1 and 50 values');
  }
  const eventTypes = value.map((eventType) => {
    const normalized = requireText(eventType, 'eventType', 3, 160).toLowerCase();
    if (!/^[a-z][a-z0-9_.-]+$/.test(normalized)) {
      throw new BadRequestException('eventType contains unsupported characters');
    }
    return normalized;
  });
  if (new Set(eventTypes).size !== eventTypes.length) {
    throw new BadRequestException('eventTypes must not contain duplicates');
  }
  return eventTypes;
}

function requireInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new BadRequestException(`${field} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function requireWebhookEndpoint(value: unknown): string {
  const raw = requireText(value, 'endpointUrl', 1, 2048);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('endpointUrl must be a valid absolute URL');
  }
  if (url.protocol !== 'https:' || (url.port !== '' && url.port !== '443')) {
    throw new BadRequestException('endpointUrl must use HTTPS on the default TLS port');
  }
  if (url.username || url.password || url.hash) {
    throw new BadRequestException('endpointUrl must not contain credentials or fragments');
  }
  const hostname = url.hostname.toLowerCase();
  if (isPrivateWebhookHost(hostname)) {
    throw new BadRequestException('endpointUrl must not target a local or private network host');
  }
  return url.toString();
}

function isPrivateWebhookHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    return true;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((octet) => octet < 0 || octet > 255)) return true;
    const [a, b] = octets;
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
  const unwrapped = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    unwrapped === '::1' ||
    unwrapped === '::' ||
    unwrapped.startsWith('fc') ||
    unwrapped.startsWith('fd') ||
    unwrapped.startsWith('fe80:')
  );
}
