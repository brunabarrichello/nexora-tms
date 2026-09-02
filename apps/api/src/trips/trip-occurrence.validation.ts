import { BadRequestException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';

export type TripOccurrenceType =
  | 'delay'
  | 'damage'
  | 'contact_loss'
  | 'accident'
  | 'breakdown'
  | 'route_deviation'
  | 'cargo_issue'
  | 'security'
  | 'documentation'
  | 'other';
export type TripOccurrenceSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TripOccurrenceStatus = 'open' | 'resolved';
export type TripOccurrenceDocumentRelation = 'evidence' | 'attachment' | 'other';

export interface TripOccurrenceInput {
  readonly tripStopId: string | null;
  readonly occurrenceType: TripOccurrenceType;
  readonly severity: TripOccurrenceSeverity;
  readonly occurredAt: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly locationText: string | null;
  readonly description: string;
  readonly responsibleUserId: string | null;
}

export interface TripOccurrenceStatusInput {
  readonly status: TripOccurrenceStatus;
  readonly note: string | null;
}

export interface TripOccurrenceTreatmentInput {
  readonly note: string;
  readonly changesResponsible: boolean;
  readonly responsibleUserId: string | null;
}

export interface TripOccurrenceDocumentInput {
  readonly documentId: string;
  readonly relationType: TripOccurrenceDocumentRelation;
}

const occurrenceTypes = new Set<TripOccurrenceType>([
  'delay',
  'damage',
  'contact_loss',
  'accident',
  'breakdown',
  'route_deviation',
  'cargo_issue',
  'security',
  'documentation',
  'other',
]);
const severities = new Set<TripOccurrenceSeverity>(['low', 'medium', 'high', 'critical']);
const statuses = new Set<TripOccurrenceStatus>(['open', 'resolved']);
const documentRelations = new Set<TripOccurrenceDocumentRelation>([
  'evidence',
  'attachment',
  'other',
]);

export function parseTripOccurrence(input: unknown): TripOccurrenceInput {
  const body = requireRecord(input);
  const latitude = optionalNumber(body.latitude, 'latitude', -90, 90);
  const longitude = optionalNumber(body.longitude, 'longitude', -180, 180);
  if ((latitude === null) !== (longitude === null)) {
    throw new BadRequestException('latitude and longitude must be provided together');
  }
  return {
    tripStopId: optionalUuid(body.tripStopId, 'tripStopId'),
    occurrenceType: requireEnum(body.occurrenceType, 'occurrenceType', occurrenceTypes),
    severity: requireEnum(body.severity ?? 'medium', 'severity', severities),
    occurredAt: requireTimestamp(body.occurredAt, 'occurredAt'),
    latitude,
    longitude,
    locationText: optionalString(body.locationText, 'locationText', 500),
    description: requireString(body.description, 'description', 2000),
    responsibleUserId: optionalUuid(body.responsibleUserId, 'responsibleUserId'),
  };
}

export function parseTripOccurrenceStatus(input: unknown): TripOccurrenceStatusInput {
  const body = requireRecord(input);
  return {
    status: requireEnum(body.status, 'status', statuses),
    note: optionalString(body.note, 'note', 2000),
  };
}

export function parseTripOccurrenceTreatment(input: unknown): TripOccurrenceTreatmentInput {
  const body = requireRecord(input);
  const changesResponsible = Object.prototype.hasOwnProperty.call(body, 'responsibleUserId');
  return {
    note: requireString(body.note, 'note', 2000),
    changesResponsible,
    responsibleUserId: changesResponsible
      ? optionalUuid(body.responsibleUserId, 'responsibleUserId')
      : null,
  };
}

export function parseTripOccurrenceDocument(input: unknown): TripOccurrenceDocumentInput {
  const body = requireRecord(input);
  return {
    documentId: requireUuidValue(body.documentId, 'documentId'),
    relationType: requireEnum(body.relationType ?? 'evidence', 'relationType', documentRelations),
  };
}

function requireRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Request body must be an object');
  }
  return input as Record<string, unknown>;
}

function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new BadRequestException(`${field} is required`);
  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} must have at most ${maxLength} characters`);
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireString(value, field, maxLength);
}

function requireTimestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${field} must be an ISO timestamp`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} must be an ISO timestamp`);
  }
  return parsed.toISOString();
}

function requireUuidValue(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a UUID`);
  return requireUuid(value, field);
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireUuidValue(value, field);
}

function optionalNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new BadRequestException(`${field} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function requireEnum<T extends string>(value: unknown, field: string, allowed: Set<T>): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return value as T;
}
