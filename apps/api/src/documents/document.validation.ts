import { BadRequestException } from '@nestjs/common';

export type DocumentTargetKind =
  | 'party'
  | 'driver'
  | 'driver_document'
  | 'asset'
  | 'asset_document'
  | 'request'
  | 'contract';

export interface DocumentListQuery {
  readonly q: string | null;
  readonly status: string | null;
  readonly validationStatus: string | null;
  readonly documentTypeId: string | null;
  readonly expiringBefore: string | null;
  readonly limit: number;
  readonly offset: number;
}

export interface DocumentCreateInput {
  readonly documentTypeId: string;
  readonly title: string;
  readonly documentNumber: string | null;
  readonly issuer: string | null;
  readonly issuedOn: string | null;
  readonly expiresOn: string | null;
  readonly isBlocking: boolean;
  readonly notes: string | null;
}

export interface DocumentVersionInput {
  readonly storageProvider: string;
  readonly storageKey: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly source: string;
  readonly metadata: Record<string, unknown>;
}

export interface DocumentValidationInput {
  readonly versionId: string | null;
  readonly validationType: string;
  readonly status: string;
  readonly provider: string | null;
  readonly ruleCode: string | null;
  readonly details: Record<string, unknown>;
  readonly notes: string | null;
}

export interface DocumentLinkInput {
  readonly targetKind: DocumentTargetKind;
  readonly targetId: string;
  readonly relationType: string;
}

const documentStatuses = new Set(['draft', 'active', 'expired', 'blocked', 'archived']);
const validationStatuses = new Set(['pending', 'validated', 'rejected', 'not_required']);
const storageProviders = new Set(['s3', 'gcs', 'azure', 'local', 'external', 'other']);
const versionSources = new Set(['upload', 'integration', 'migration', 'generated']);
const validationTypes = new Set(['manual', 'automated', 'antifraud', 'compliance', 'other']);
const validationResultStatuses = new Set([
  'pending',
  'validated',
  'rejected',
  'warning',
  'not_applicable',
]);
const targetKinds = new Set<DocumentTargetKind>([
  'party',
  'driver',
  'driver_document',
  'asset',
  'asset_document',
  'request',
  'contract',
]);

export function parseDocumentListQuery(input: Record<string, unknown>): DocumentListQuery {
  return {
    q: optionalText(queryValue(input.q), 'q', 240),
    status: optionalEnum(queryValue(input.status), 'status', documentStatuses),
    validationStatus: optionalEnum(
      queryValue(input.validationStatus),
      'validationStatus',
      validationStatuses,
    ),
    documentTypeId: optionalUuid(queryValue(input.documentTypeId), 'documentTypeId'),
    expiringBefore: optionalDate(queryValue(input.expiringBefore), 'expiringBefore'),
    limit: integerValue(queryValue(input.limit), 'limit', 50, 1, 100),
    offset: integerValue(queryValue(input.offset), 'offset', 0, 0, 100_000),
  };
}

export function parseDocumentCreate(input: unknown): DocumentCreateInput {
  const body = objectBody(input);
  const issuedOn = optionalDate(body.issuedOn, 'issuedOn');
  const expiresOn = optionalDate(body.expiresOn, 'expiresOn');
  if (issuedOn && expiresOn && expiresOn < issuedOn) {
    throw new BadRequestException('expiresOn must be on or after issuedOn');
  }
  return {
    documentTypeId: uuid(body.documentTypeId, 'documentTypeId'),
    title: text(body.title, 'title', 240),
    documentNumber: optionalText(body.documentNumber, 'documentNumber', 120),
    issuer: optionalText(body.issuer, 'issuer', 180),
    issuedOn,
    expiresOn,
    isBlocking: optionalBoolean(body.isBlocking, 'isBlocking', false),
    notes: optionalText(body.notes, 'notes', 1500),
  };
}

export function parseDocumentVersion(input: unknown): DocumentVersionInput {
  const body = objectBody(input);
  const sizeBytes = numberValue(body.sizeBytes, 'sizeBytes');
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new BadRequestException('sizeBytes must be a positive safe integer');
  }
  const sha256 = text(body.sha256, 'sha256', 64).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    throw new BadRequestException('sha256 must contain exactly 64 hexadecimal characters');
  }
  return {
    storageProvider: requiredEnum(body.storageProvider, 'storageProvider', storageProviders),
    storageKey: text(body.storageKey, 'storageKey', 500),
    fileName: text(body.fileName, 'fileName', 255),
    mimeType: text(body.mimeType, 'mimeType', 160),
    sizeBytes,
    sha256,
    source:
      body.source === undefined
        ? 'upload'
        : requiredEnum(body.source, 'source', versionSources),
    metadata: objectValue(body.metadata, 'metadata', {}),
  };
}

export function parseDocumentValidation(input: unknown): DocumentValidationInput {
  const body = objectBody(input);
  return {
    versionId: optionalUuid(body.versionId, 'versionId'),
    validationType: requiredEnum(body.validationType, 'validationType', validationTypes),
    status: requiredEnum(body.status, 'status', validationResultStatuses),
    provider: optionalText(body.provider, 'provider', 120),
    ruleCode: optionalText(body.ruleCode, 'ruleCode', 120),
    details: objectValue(body.details, 'details', {}),
    notes: optionalText(body.notes, 'notes', 1500),
  };
}

export function parseDocumentLink(input: unknown): DocumentLinkInput {
  const body = objectBody(input);
  const kind = requiredEnum(body.targetKind, 'targetKind', targetKinds) as DocumentTargetKind;
  return {
    targetKind: kind,
    targetId: uuid(body.targetId, 'targetId'),
    relationType:
      body.relationType === undefined
        ? 'attachment'
        : text(body.relationType, 'relationType', 64),
  };
}

export function parseUnlink(input: unknown): { readonly reason: string } {
  const body = objectBody(input);
  return { reason: text(body.reason, 'reason', 1000) };
}

export function requireUuid(value: string, field = 'id'): string {
  if (!isUuid(value)) throw new BadRequestException(`${field} must be a valid UUID`);
  return value;
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
  }
  return value as Record<string, unknown>;
}

function objectValue(
  value: unknown,
  field: string,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  if (value === undefined || value === null) return fallback;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new BadRequestException(`${field} is required`);
  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} must contain at most ${maxLength} characters`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field, maxLength);
}

function optionalBoolean(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'boolean') throw new BadRequestException(`${field} must be a boolean`);
  return value;
}

function numberValue(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new BadRequestException(`${field} must be a number`);
  return parsed;
}

function integerValue(
  value: unknown,
  field: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = numberValue(value, field);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(`${field} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function optionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${field} must use YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${field} must be a valid date`);
  }
  return value;
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return uuid(value, field);
}

function uuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isUuid(value)) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return value;
}

function optionalEnum(value: unknown, field: string, values: ReadonlySet<string>): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredEnum(value, field, values);
}

function requiredEnum(value: unknown, field: string, values: ReadonlySet<string>): string {
  if (typeof value !== 'string' || !values.has(value)) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return value;
}

function queryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
