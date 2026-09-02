import { BadRequestException } from '@nestjs/common';

import { requireUuid } from './documents.validation.js';

export type DocumentComplianceContext = 'contracting' | 'trip';
export type DocumentComplianceSubjectScope = 'party' | 'driver' | 'asset';

export interface DocumentCompliancePolicyInput {
  readonly documentTypeId: string;
  readonly requiredForContracting: boolean;
  readonly requiredForTrip: boolean;
  readonly warningDays: number;
  readonly blockWhenExpiringSoon: boolean;
  readonly blockWhenPending: boolean;
  readonly blockWhenRejected: boolean;
  readonly blockWhenExpired: boolean;
  readonly isActive: boolean;
}

export interface DocumentComplianceOverrideInput {
  readonly context: DocumentComplianceContext;
  readonly subjectScope: DocumentComplianceSubjectScope;
  readonly subjectId: string;
  readonly documentTypeId: string;
  readonly reason: string;
  readonly validUntil: string;
}

export function parseCompliancePolicy(input: unknown): DocumentCompliancePolicyInput {
  const body = object(input);
  const requiredForContracting = booleanValue(
    body.requiredForContracting,
    'requiredForContracting',
    false,
  );
  const requiredForTrip = booleanValue(body.requiredForTrip, 'requiredForTrip', false);
  if (!requiredForContracting && !requiredForTrip) {
    throw new BadRequestException(
      'at least one compliance context must be enabled: contracting or trip',
    );
  }

  return {
    documentTypeId: requireUuid(
      stringValue(body.documentTypeId, 'documentTypeId', 80),
      'documentTypeId',
    ),
    requiredForContracting,
    requiredForTrip,
    warningDays: integerValue(body.warningDays, 'warningDays', 30, 0, 365),
    blockWhenExpiringSoon: booleanValue(body.blockWhenExpiringSoon, 'blockWhenExpiringSoon', false),
    blockWhenPending: booleanValue(body.blockWhenPending, 'blockWhenPending', true),
    blockWhenRejected: booleanValue(body.blockWhenRejected, 'blockWhenRejected', true),
    blockWhenExpired: booleanValue(body.blockWhenExpired, 'blockWhenExpired', true),
    isActive: booleanValue(body.isActive, 'isActive', true),
  };
}

export function parseComplianceOverride(input: unknown): DocumentComplianceOverrideInput {
  const body = object(input);
  const validUntil = stringValue(body.validUntil, 'validUntil', 64);
  const parsedUntil = Date.parse(validUntil);
  if (Number.isNaN(parsedUntil)) {
    throw new BadRequestException('validUntil must be an ISO-8601 date-time');
  }
  const now = Date.now();
  if (parsedUntil <= now) {
    throw new BadRequestException('validUntil must be in the future');
  }
  if (parsedUntil > now + 30 * 86_400_000) {
    throw new BadRequestException('administrative overrides are limited to 30 days');
  }

  const reason = stringValue(body.reason, 'reason', 1000);
  if (reason.length < 10) {
    throw new BadRequestException('reason must contain at least 10 characters');
  }

  return {
    context: enumeration(body.context, 'context', ['contracting', 'trip']),
    subjectScope: enumeration(body.subjectScope, 'subjectScope', ['party', 'driver', 'asset']),
    subjectId: requireUuid(stringValue(body.subjectId, 'subjectId', 80), 'subjectId'),
    documentTypeId: requireUuid(
      stringValue(body.documentTypeId, 'documentTypeId', 80),
      'documentTypeId',
    ),
    reason,
    validUntil: new Date(parsedUntil).toISOString(),
  };
}

export function parseComplianceContext(value: string): DocumentComplianceContext {
  return enumeration(value, 'context', ['contracting', 'trip']);
}

export function parseComplianceSubjectScope(value: string): DocumentComplianceSubjectScope {
  return enumeration(value, 'subjectScope', ['party', 'driver', 'asset']);
}

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('request body must be an object');
  }
  return input as Record<string, unknown>;
}

function stringValue(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized) throw new BadRequestException(`${field} is required`);
  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} must contain at most ${maxLength} characters`);
  }
  return normalized;
}

function booleanValue(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${field} must be boolean`);
  }
  return value;
}

function integerValue(
  value: unknown,
  field: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new BadRequestException(`${field} must be an integer`);
  }
  if (value < minimum || value > maximum) {
    throw new BadRequestException(`${field} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function enumeration<const T extends readonly string[]>(
  value: unknown,
  field: string,
  allowed: T,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new BadRequestException(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T[number];
}
