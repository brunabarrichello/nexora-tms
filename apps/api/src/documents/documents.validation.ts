import { BadRequestException } from '@nestjs/common';

export interface CreateDocumentInput {
  readonly documentTypeId: string;
  readonly title: string;
  readonly issuedOn: string | null;
  readonly expiresOn: string | null;
  readonly externalReference: string | null;
  readonly notes: string | null;
  readonly metadata: Record<string, unknown>;
}

export interface UpdateDocumentInput {
  title?: string;
  issuedOn?: string | null;
  expiresOn?: string | null;
  externalReference?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PrepareUploadInput {
  readonly originalFileName: string;
  readonly mimeType: string;
  readonly expectedByteSize: number | null;
  readonly checksumSha256: string | null;
}

export interface CommitUploadInput {
  readonly uploadId: string;
  readonly source: 'upload' | 'import' | 'generated' | 'integration';
  readonly metadata: Record<string, unknown>;
}

export interface DocumentValidationInput {
  readonly documentVersionId: string | null;
  readonly validationType: 'manual' | 'system' | 'external';
  readonly result: 'valid' | 'invalid' | 'review_required';
  readonly notes: string | null;
  readonly providerReference: string | null;
  readonly details: Record<string, unknown>;
}

export interface DocumentLinkInput {
  readonly relationType: string;
}

export interface DeleteDocumentInput {
  readonly reason: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const checksumPattern = /^[0-9a-f]{64}$/;

export function requireUuid(value: string, field = 'id'): string {
  if (!uuidPattern.test(value)) throw new BadRequestException(`${field} must be a valid UUID`);
  return value;
}

export function parseCreateDocument(input: unknown): CreateDocumentInput {
  const body = object(input);
  const issuedOn = optionalDate(body.issuedOn, 'issuedOn');
  const expiresOn = optionalDate(body.expiresOn, 'expiresOn');
  chronological(issuedOn, expiresOn, 'document validity');
  return {
    documentTypeId: requireUuid(
      requiredString(body.documentTypeId, 'documentTypeId', 80),
      'documentTypeId',
    ),
    title: requiredString(body.title, 'title', 240),
    issuedOn,
    expiresOn,
    externalReference: optionalString(body.externalReference, 'externalReference', 180),
    notes: optionalString(body.notes, 'notes', 1500),
    metadata: record(body.metadata, 'metadata'),
  };
}

export function parseUpdateDocument(input: unknown): UpdateDocumentInput {
  const body = object(input);
  const result: UpdateDocumentInput = {};
  if ('title' in body) result.title = requiredString(body.title, 'title', 240);
  if ('issuedOn' in body) result.issuedOn = optionalDate(body.issuedOn, 'issuedOn');
  if ('expiresOn' in body) result.expiresOn = optionalDate(body.expiresOn, 'expiresOn');
  if ('externalReference' in body)
    result.externalReference = optionalString(body.externalReference, 'externalReference', 180);
  if ('notes' in body) result.notes = optionalString(body.notes, 'notes', 1500);
  if ('metadata' in body) result.metadata = record(body.metadata, 'metadata');
  if (Object.keys(result).length === 0)
    throw new BadRequestException('at least one document field is required');
  if (result.issuedOn !== undefined && result.expiresOn !== undefined)
    chronological(result.issuedOn, result.expiresOn, 'document validity');
  return result;
}

export function parsePrepareUpload(input: unknown): PrepareUploadInput {
  const body = object(input);
  return {
    originalFileName: requiredString(body.originalFileName, 'originalFileName', 255),
    mimeType: requiredString(body.mimeType, 'mimeType', 160),
    expectedByteSize: optionalPositiveInteger(body.expectedByteSize, 'expectedByteSize'),
    checksumSha256: optionalChecksum(body.checksumSha256),
  };
}

export function parseCommitUpload(input: unknown): CommitUploadInput {
  const body = object(input);
  return {
    uploadId: requiredString(body.uploadId, 'uploadId', 500),
    source: enumeration(body.source ?? 'upload', 'source', [
      'upload',
      'import',
      'generated',
      'integration',
    ]),
    metadata: record(body.metadata, 'metadata'),
  };
}

export function parseDocumentValidation(input: unknown): DocumentValidationInput {
  const body = object(input);
  return {
    documentVersionId: optionalUuid(body.documentVersionId, 'documentVersionId'),
    validationType: enumeration(body.validationType ?? 'manual', 'validationType', [
      'manual',
      'system',
      'external',
    ]),
    result: enumeration(body.result, 'result', ['valid', 'invalid', 'review_required']),
    notes: optionalString(body.notes, 'notes', 1500),
    providerReference: optionalString(body.providerReference, 'providerReference', 180),
    details: record(body.details, 'details'),
  };
}

export function parsePartyLink(input: unknown): DocumentLinkInput {
  const body = object(input);
  return {
    relationType: enumeration(body.relationType ?? 'registration', 'relationType', [
      'registration',
      'compliance',
      'contract',
      'insurance',
      'other',
    ]),
  };
}

export function parseTransportRequestLink(input: unknown): DocumentLinkInput {
  const body = object(input);
  return {
    relationType: enumeration(body.relationType ?? 'request', 'relationType', [
      'request',
      'commercial',
      'compliance',
      'reference',
      'other',
    ]),
  };
}

export function parseDeleteDocument(input: unknown): DeleteDocumentInput {
  const body = object(input);
  return { reason: requiredString(body.reason, 'reason', 1000) };
}

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('request body must be an object');
  return input as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new BadRequestException(`${field} is required`);
  if (normalized.length > maxLength)
    throw new BadRequestException(`${field} must contain at most ${maxLength} characters`);
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredString(value, field, maxLength);
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requireUuid(requiredString(value, field, 80), field);
}

function optionalDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  const date = requiredString(value, field, 10);
  if (!datePattern.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))
    throw new BadRequestException(`${field} must use YYYY-MM-DD`);
  return date;
}

function chronological(start: string | null, end: string | null, label: string): void {
  if (start && end && Date.parse(end) < Date.parse(start))
    throw new BadRequestException(`${label} end must be on or after start`);
}

function optionalPositiveInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    throw new BadRequestException(`${field} must be a positive integer`);
  return value;
}

function optionalChecksum(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const checksum = requiredString(value, 'checksumSha256', 64).toLowerCase();
  if (!checksumPattern.test(checksum))
    throw new BadRequestException(
      'checksumSha256 must be a 64-character lowercase hexadecimal SHA-256',
    );
  return checksum;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function enumeration<const T extends readonly string[]>(
  value: unknown,
  field: string,
  allowed: T,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value))
    throw new BadRequestException(`${field} must be one of: ${allowed.join(', ')}`);
  return value as T[number];
}
