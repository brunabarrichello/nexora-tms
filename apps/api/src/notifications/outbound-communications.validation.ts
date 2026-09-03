import { BadRequestException } from '@nestjs/common';

import type {
  CommunicationChannel,
  CommunicationConsentStatus,
  CommunicationRecipientType,
} from './outbound-communications.types.js';

export interface UpsertProviderRouteInput {
  readonly providerCode: string;
  readonly status: 'active' | 'disabled';
}

export interface CreateCommunicationTemplateInput {
  readonly templateKey: string;
  readonly channel: CommunicationChannel;
  readonly locale: string;
  readonly version: number;
  readonly subjectTemplate: string | null;
  readonly bodyTemplate: string;
  readonly status: 'draft' | 'active';
}

export interface SetCommunicationTemplateStatusInput {
  readonly status: 'active' | 'retired';
}

export interface UpsertCommunicationPreferenceInput {
  readonly recipientType: CommunicationRecipientType;
  readonly recipientId: string;
  readonly channel: CommunicationChannel;
  readonly enabled: boolean;
  readonly consentStatus: CommunicationConsentStatus;
  readonly consentSource: string | null;
  readonly consentedAt: string | null;
  readonly policyVersion: string;
}

export interface QueueCommunicationInput {
  readonly templateId: string;
  readonly recipientType: CommunicationRecipientType;
  readonly recipientId: string;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly maxAttempts: number;
}

export function requireUuid(value: string, field: string): string {
  const normalized = value.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
  ) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return normalized;
}

export function parseLimit(value?: string): number {
  if (!value) return 100;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 200) {
    throw new BadRequestException('limit must be an integer between 1 and 200');
  }
  return parsed;
}

export function parseChannel(value: string, field = 'channel'): CommunicationChannel {
  if (value === 'email' || value === 'whatsapp' || value === 'sms') return value;
  throw new BadRequestException(`${field} must be one of: email, whatsapp, sms`);
}

export function parseRecipientType(value: string): CommunicationRecipientType {
  if (value === 'driver' || value === 'party_contact') return value;
  throw new BadRequestException('recipientType must be one of: driver, party_contact');
}

export function parseUpsertProviderRoute(body: unknown): UpsertProviderRouteInput {
  const record = requireRecord(body);
  const providerCode = requireString(record.providerCode, 'providerCode', 2, 80);
  if (!/^[a-z][a-z0-9._-]{1,79}$/.test(providerCode)) {
    throw new BadRequestException('providerCode has an invalid format');
  }
  const status = record.status === undefined ? 'active' : record.status;
  if (status !== 'active' && status !== 'disabled') {
    throw new BadRequestException('status must be one of: active, disabled');
  }
  return { providerCode, status };
}

export function parseCreateTemplate(body: unknown): CreateCommunicationTemplateInput {
  const record = requireRecord(body);
  const templateKey = requireString(record.templateKey, 'templateKey', 3, 120);
  if (!/^[a-z][a-z0-9._-]{2,119}$/.test(templateKey)) {
    throw new BadRequestException('templateKey has an invalid format');
  }
  const channel = parseChannel(requireString(record.channel, 'channel', 3, 20));
  const locale = optionalString(record.locale, 'locale', 2, 16) ?? 'pt-BR';
  const version = requireInteger(record.version, 'version', 1, 1_000_000);
  const subjectTemplate = optionalString(record.subjectTemplate, 'subjectTemplate', 1, 500);
  const bodyTemplate = requireString(record.bodyTemplate, 'bodyTemplate', 1, 10_000);
  const status = record.status === undefined ? 'draft' : record.status;
  if (status !== 'draft' && status !== 'active') {
    throw new BadRequestException('status must be one of: draft, active');
  }
  if (channel === 'email' && !subjectTemplate) {
    throw new BadRequestException('email templates require subjectTemplate');
  }
  return { templateKey, channel, locale, version, subjectTemplate, bodyTemplate, status };
}

export function parseTemplateStatus(body: unknown): SetCommunicationTemplateStatusInput {
  const record = requireRecord(body);
  if (record.status !== 'active' && record.status !== 'retired') {
    throw new BadRequestException('status must be one of: active, retired');
  }
  return { status: record.status };
}

export function parsePreference(body: unknown): UpsertCommunicationPreferenceInput {
  const record = requireRecord(body);
  const recipientType = parseRecipientType(
    requireString(record.recipientType, 'recipientType', 3, 30),
  );
  const recipientId = requireUuid(
    requireString(record.recipientId, 'recipientId', 36, 36),
    'recipientId',
  );
  const channel = parseChannel(requireString(record.channel, 'channel', 3, 20));
  if (typeof record.enabled !== 'boolean') {
    throw new BadRequestException('enabled must be a boolean');
  }
  const consentStatus = record.consentStatus;
  if (consentStatus !== 'granted' && consentStatus !== 'denied' && consentStatus !== 'unknown') {
    throw new BadRequestException('consentStatus must be one of: granted, denied, unknown');
  }
  if (record.enabled && consentStatus !== 'granted') {
    throw new BadRequestException('enabled channel requires granted consent');
  }
  const consentSource = optionalString(record.consentSource, 'consentSource', 2, 160);
  const consentedAt = optionalIsoDate(record.consentedAt, 'consentedAt');
  if (consentStatus === 'granted' && (!consentSource || !consentedAt)) {
    throw new BadRequestException('granted consent requires consentSource and consentedAt');
  }
  const policyVersion = requireString(record.policyVersion, 'policyVersion', 1, 80);
  return {
    recipientType,
    recipientId,
    channel,
    enabled: record.enabled,
    consentStatus,
    consentSource,
    consentedAt,
    policyVersion,
  };
}

export function parseQueueCommunication(body: unknown): QueueCommunicationInput {
  const record = requireRecord(body);
  const templateId = requireUuid(
    requireString(record.templateId, 'templateId', 36, 36),
    'templateId',
  );
  const recipientType = parseRecipientType(
    requireString(record.recipientType, 'recipientType', 3, 30),
  );
  const recipientId = requireUuid(
    requireString(record.recipientId, 'recipientId', 36, 36),
    'recipientId',
  );
  const variables = record.variables === undefined ? {} : requireRecord(record.variables);
  const idempotencyKey = requireString(record.idempotencyKey, 'idempotencyKey', 3, 180);
  const maxAttempts =
    record.maxAttempts === undefined ? 5 : requireInteger(record.maxAttempts, 'maxAttempts', 1, 20);
  return { templateId, recipientType, recipientId, variables, idempotencyKey, maxAttempts };
}

export function parseCommunicationStatus(value?: string): string | null {
  if (!value) return null;
  if (['queued', 'retry_wait', 'sent', 'failed', 'blocked', 'cancelled'].includes(value)) {
    return value;
  }
  throw new BadRequestException(
    'status must be one of: queued, retry_wait, sent, failed, blocked, cancelled',
  );
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('request body must be a JSON object');
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a string`);
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new BadRequestException(
      `${field} must contain between ${minimum} and ${maximum} characters`,
    );
  }
  return normalized;
}

function optionalString(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireString(value, field, minimum, maximum);
}

function requireInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new BadRequestException(`${field} must be an integer between ${minimum} and ${maximum}`);
  }
  return value as number;
}

function optionalIsoDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new BadRequestException(`${field} must be a valid ISO date-time`);
  }
  return new Date(value).toISOString();
}
