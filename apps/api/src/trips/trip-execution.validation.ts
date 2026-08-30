import { BadRequestException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';

export type TripExecutionSource = 'manual' | 'mobile' | 'gps' | 'integration';
export type TripEventType =
  | 'dispatch'
  | 'departure'
  | 'arrival'
  | 'pickup'
  | 'delivery'
  | 'checkpoint'
  | 'delay'
  | 'status_change'
  | 'note';
export type TripCheckinType = 'arrival' | 'departure' | 'pickup' | 'delivery' | 'checkpoint';
export type TripChecklistStatus = 'completed' | 'waived' | 'failed';
export type TripExpenseStatus = 'approved' | 'rejected' | 'voided';

export interface TripEventInput {
  readonly tripStopId: string | null;
  readonly eventType: TripEventType;
  readonly source: 'manual' | 'mobile' | 'integration';
  readonly title: string;
  readonly description: string | null;
  readonly occurredAt: string;
  readonly metadata: Record<string, unknown>;
}

export interface TripCheckinInput {
  readonly tripStopId: string;
  readonly checkinType: TripCheckinType;
  readonly source: TripExecutionSource;
  readonly occurredAt: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly notes: string | null;
}

export interface TripLocationInput {
  readonly tripStopId: string | null;
  readonly source: TripExecutionSource;
  readonly provider: string | null;
  readonly providerEventId: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyM: number | null;
  readonly speedKmh: number | null;
  readonly headingDegrees: number | null;
  readonly recordedAt: string;
  readonly metadata: Record<string, unknown>;
}

export interface TripChecklistInput {
  readonly tripStopId: string | null;
  readonly category: string;
  readonly itemCode: string;
  readonly label: string;
  readonly required: boolean;
  readonly notes: string | null;
}

export interface TripChecklistStatusInput {
  readonly status: TripChecklistStatus;
  readonly waiverReason: string | null;
  readonly notes: string | null;
}

export interface TripDocumentInput {
  readonly tripStopId: string | null;
  readonly documentId: string;
  readonly relationType:
    | 'execution'
    | 'pickup_proof'
    | 'delivery_proof'
    | 'expense_receipt'
    | 'toll_receipt'
    | 'fuel_receipt'
    | 'checklist_evidence'
    | 'other';
}

export interface TripExpenseInput {
  readonly tripStopId: string | null;
  readonly tripDocumentId: string | null;
  readonly category: 'parking' | 'meal' | 'lodging' | 'repair' | 'loading' | 'unloading' | 'other';
  readonly amount: number;
  readonly currencyId: string;
  readonly incurredAt: string;
  readonly merchant: string | null;
  readonly externalReference: string | null;
  readonly description: string | null;
}

export interface TripExpenseStatusInput {
  readonly status: TripExpenseStatus;
  readonly reason: string | null;
}

export interface TripTollInput {
  readonly tripStopId: string | null;
  readonly tripDocumentId: string | null;
  readonly plaza: string;
  readonly road: string | null;
  readonly amount: number;
  readonly currencyId: string;
  readonly occurredAt: string;
  readonly paymentMethod: 'cash' | 'tag' | 'card' | 'invoice' | 'other';
  readonly tagReference: string | null;
  readonly notes: string | null;
}

export interface TripFuelInput {
  readonly tripStopId: string | null;
  readonly tripDocumentId: string | null;
  readonly fuelType: 'diesel' | 'gasoline' | 'ethanol' | 'cng' | 'electric' | 'other';
  readonly liters: number;
  readonly unitPrice: number;
  readonly totalAmount: number;
  readonly currencyId: string;
  readonly odometerKm: number | null;
  readonly station: string | null;
  readonly fueledAt: string;
  readonly notes: string | null;
}

export interface TripProofInput {
  readonly tripStopId: string | null;
  readonly tripDocumentId: string;
  readonly proofType: 'pickup' | 'delivery' | 'seal' | 'weight' | 'checklist' | 'other';
  readonly capturedAt: string;
  readonly source: 'manual' | 'mobile' | 'integration' | 'generated';
  readonly notes: string | null;
  readonly metadata: Record<string, unknown>;
}

export interface TripDeliveryProofInput {
  readonly tripStopId: string;
  readonly tripProofId: string;
  readonly receivedByName: string;
  readonly receivedByRole: string | null;
  readonly deliveredAt: string;
  readonly status: 'recorded' | 'accepted' | 'rejected';
  readonly exceptionReason: string | null;
}

const eventTypes = new Set<TripEventType>([
  'dispatch',
  'departure',
  'arrival',
  'pickup',
  'delivery',
  'checkpoint',
  'delay',
  'status_change',
  'note',
]);
const eventSources = new Set(['manual', 'mobile', 'integration'] as const);
const executionSources = new Set<TripExecutionSource>(['manual', 'mobile', 'gps', 'integration']);
const checkinTypes = new Set<TripCheckinType>([
  'arrival',
  'departure',
  'pickup',
  'delivery',
  'checkpoint',
]);
const checklistStatuses = new Set<TripChecklistStatus>(['completed', 'waived', 'failed']);
const documentRelations = new Set<TripDocumentInput['relationType']>([
  'execution',
  'pickup_proof',
  'delivery_proof',
  'expense_receipt',
  'toll_receipt',
  'fuel_receipt',
  'checklist_evidence',
  'other',
]);
const expenseCategories = new Set<TripExpenseInput['category']>([
  'parking',
  'meal',
  'lodging',
  'repair',
  'loading',
  'unloading',
  'other',
]);
const expenseStatuses = new Set<TripExpenseStatus>(['approved', 'rejected', 'voided']);
const paymentMethods = new Set<TripTollInput['paymentMethod']>([
  'cash',
  'tag',
  'card',
  'invoice',
  'other',
]);
const fuelTypes = new Set<TripFuelInput['fuelType']>([
  'diesel',
  'gasoline',
  'ethanol',
  'cng',
  'electric',
  'other',
]);
const proofTypes = new Set<TripProofInput['proofType']>([
  'pickup',
  'delivery',
  'seal',
  'weight',
  'checklist',
  'other',
]);
const proofSources = new Set<TripProofInput['source']>([
  'manual',
  'mobile',
  'integration',
  'generated',
]);
const deliveryProofStatuses = new Set<TripDeliveryProofInput['status']>([
  'recorded',
  'accepted',
  'rejected',
]);

export function parseTripEvent(input: unknown): TripEventInput {
  const body = requireRecord(input);
  return {
    tripStopId: optionalUuid(body.tripStopId, 'tripStopId'),
    eventType: requireEnum(body.eventType, 'eventType', eventTypes),
    source: requireEnum(body.source ?? 'manual', 'source', eventSources),
    title: requireString(body.title, 'title', 180),
    description: optionalString(body.description, 'description', 1500),
    occurredAt: requireTimestamp(body.occurredAt, 'occurredAt'),
    metadata: optionalMetadata(body.metadata, 'metadata'),
  };
}

export function parseTripCheckin(input: unknown): TripCheckinInput {
  const body = requireRecord(input);
  const latitude = optionalNumber(body.latitude, 'latitude', -90, 90);
  const longitude = optionalNumber(body.longitude, 'longitude', -180, 180);
  if ((latitude === null) !== (longitude === null)) {
    throw new BadRequestException('latitude and longitude must be provided together');
  }
  return {
    tripStopId: requireUuidValue(body.tripStopId, 'tripStopId'),
    checkinType: requireEnum(body.checkinType, 'checkinType', checkinTypes),
    source: requireEnum(body.source ?? 'manual', 'source', executionSources),
    occurredAt: requireTimestamp(body.occurredAt, 'occurredAt'),
    latitude,
    longitude,
    notes: optionalString(body.notes, 'notes', 1000),
  };
}

export function parseTripLocation(input: unknown): TripLocationInput {
  const body = requireRecord(input);
  const source = requireEnum(body.source, 'source', executionSources);
  const provider = optionalString(body.provider, 'provider', 80);
  if (source === 'integration' && !provider) {
    throw new BadRequestException('provider is required for integration locations');
  }
  return {
    tripStopId: optionalUuid(body.tripStopId, 'tripStopId'),
    source,
    provider,
    providerEventId: optionalString(body.providerEventId, 'providerEventId', 180),
    latitude: requireNumber(body.latitude, 'latitude', -90, 90),
    longitude: requireNumber(body.longitude, 'longitude', -180, 180),
    accuracyM: optionalNumber(body.accuracyM, 'accuracyM', 0),
    speedKmh: optionalNumber(body.speedKmh, 'speedKmh', 0),
    headingDegrees: optionalNumber(body.headingDegrees, 'headingDegrees', 0, 359.999),
    recordedAt: requireTimestamp(body.recordedAt, 'recordedAt'),
    metadata: optionalMetadata(body.metadata, 'metadata'),
  };
}

export function parseTripChecklist(input: unknown): TripChecklistInput {
  const body = requireRecord(input);
  return {
    tripStopId: optionalUuid(body.tripStopId, 'tripStopId'),
    category: requireString(body.category, 'category', 40),
    itemCode: requireString(body.itemCode, 'itemCode', 80),
    label: requireString(body.label, 'label', 240),
    required: optionalBoolean(body.required, 'required', false),
    notes: optionalString(body.notes, 'notes', 1000),
  };
}

export function parseTripChecklistStatus(input: unknown): TripChecklistStatusInput {
  const body = requireRecord(input);
  const status = requireEnum(body.status, 'status', checklistStatuses);
  const waiverReason = optionalString(body.waiverReason, 'waiverReason', 1000);
  if (status === 'waived' && !waiverReason) {
    throw new BadRequestException('waiverReason is required when waiving a checklist item');
  }
  return { status, waiverReason, notes: optionalString(body.notes, 'notes', 1000) };
}

export function parseTripDocument(input: unknown): TripDocumentInput {
  const body = requireRecord(input);
  return {
    tripStopId: optionalUuid(body.tripStopId, 'tripStopId'),
    documentId: requireUuidValue(body.documentId, 'documentId'),
    relationType: requireEnum(body.relationType ?? 'execution', 'relationType', documentRelations),
  };
}

export function parseTripExpense(input: unknown): TripExpenseInput {
  const body = requireRecord(input);
  return {
    tripStopId: optionalUuid(body.tripStopId, 'tripStopId'),
    tripDocumentId: optionalUuid(body.tripDocumentId, 'tripDocumentId'),
    category: requireEnum(body.category, 'category', expenseCategories),
    amount: requireNumber(body.amount, 'amount', 0.01),
    currencyId: requireUuidValue(body.currencyId, 'currencyId'),
    incurredAt: requireTimestamp(body.incurredAt, 'incurredAt'),
    merchant: optionalString(body.merchant, 'merchant', 180),
    externalReference: optionalString(body.externalReference, 'externalReference', 180),
    description: optionalString(body.description, 'description', 1000),
  };
}

export function parseTripExpenseStatus(input: unknown): TripExpenseStatusInput {
  const body = requireRecord(input);
  const status = requireEnum(body.status, 'status', expenseStatuses);
  const reason = optionalString(body.reason, 'reason', 1000);
  if ((status === 'rejected' || status === 'voided') && !reason) {
    throw new BadRequestException('reason is required when rejecting or voiding an expense');
  }
  return { status, reason };
}

export function parseTripToll(input: unknown): TripTollInput {
  const body = requireRecord(input);
  return {
    tripStopId: optionalUuid(body.tripStopId, 'tripStopId'),
    tripDocumentId: optionalUuid(body.tripDocumentId, 'tripDocumentId'),
    plaza: requireString(body.plaza, 'plaza', 180),
    road: optionalString(body.road, 'road', 120),
    amount: requireNumber(body.amount, 'amount', 0.01),
    currencyId: requireUuidValue(body.currencyId, 'currencyId'),
    occurredAt: requireTimestamp(body.occurredAt, 'occurredAt'),
    paymentMethod: requireEnum(body.paymentMethod, 'paymentMethod', paymentMethods),
    tagReference: optionalString(body.tagReference, 'tagReference', 120),
    notes: optionalString(body.notes, 'notes', 1000),
  };
}

export function parseTripFuel(input: unknown): TripFuelInput {
  const body = requireRecord(input);
  return {
    tripStopId: optionalUuid(body.tripStopId, 'tripStopId'),
    tripDocumentId: optionalUuid(body.tripDocumentId, 'tripDocumentId'),
    fuelType: requireEnum(body.fuelType, 'fuelType', fuelTypes),
    liters: requireNumber(body.liters, 'liters', 0.001),
    unitPrice: requireNumber(body.unitPrice, 'unitPrice', 0.0001),
    totalAmount: requireNumber(body.totalAmount, 'totalAmount', 0.01),
    currencyId: requireUuidValue(body.currencyId, 'currencyId'),
    odometerKm: optionalNumber(body.odometerKm, 'odometerKm', 0),
    station: optionalString(body.station, 'station', 180),
    fueledAt: requireTimestamp(body.fueledAt, 'fueledAt'),
    notes: optionalString(body.notes, 'notes', 1000),
  };
}

export function parseTripProof(input: unknown): TripProofInput {
  const body = requireRecord(input);
  return {
    tripStopId: optionalUuid(body.tripStopId, 'tripStopId'),
    tripDocumentId: requireUuidValue(body.tripDocumentId, 'tripDocumentId'),
    proofType: requireEnum(body.proofType, 'proofType', proofTypes),
    capturedAt: requireTimestamp(body.capturedAt, 'capturedAt'),
    source: requireEnum(body.source ?? 'manual', 'source', proofSources),
    notes: optionalString(body.notes, 'notes', 1000),
    metadata: optionalMetadata(body.metadata, 'metadata'),
  };
}

export function parseTripDeliveryProof(input: unknown): TripDeliveryProofInput {
  const body = requireRecord(input);
  const status = requireEnum(body.status ?? 'recorded', 'status', deliveryProofStatuses);
  const exceptionReason = optionalString(body.exceptionReason, 'exceptionReason', 1000);
  if (status === 'rejected' && !exceptionReason) {
    throw new BadRequestException('exceptionReason is required for a rejected delivery proof');
  }
  return {
    tripStopId: requireUuidValue(body.tripStopId, 'tripStopId'),
    tripProofId: requireUuidValue(body.tripProofId, 'tripProofId'),
    receivedByName: requireString(body.receivedByName, 'receivedByName', 180),
    receivedByRole: optionalString(body.receivedByRole, 'receivedByRole', 120),
    deliveredAt: requireTimestamp(body.deliveredAt, 'deliveredAt'),
    status,
    exceptionReason,
  };
}

function requireRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Request body must be an object');
  }
  return input as Record<string, unknown>;
}

function requireString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`);
  const normalized = value.trim();
  if (normalized.length > max) throw new BadRequestException(`${field} must not exceed ${max} characters`);
  return normalized;
}

function optionalString(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireString(value, field, max);
}

function requireUuidValue(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a UUID`);
  return requireUuid(value, field);
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireUuidValue(value, field);
}

function requireTimestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new BadRequestException(`${field} must be a valid timestamp`);
  }
  return new Date(Date.parse(value)).toISOString();
}

function requireEnum<T extends string>(value: unknown, field: string, allowed: Set<T>): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return value as T;
}

function requireNumber(
  value: unknown,
  field: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return value;
}

function optionalNumber(
  value: unknown,
  field: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number | null {
  if (value === undefined || value === null || value === '') return null;
  return requireNumber(value, field, min, max);
}

function optionalBoolean(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') throw new BadRequestException(`${field} must be a boolean`);
  return value;
}

function optionalMetadata(value: unknown, field: string): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${field} must be an object`);
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > 16_384) {
    throw new BadRequestException(`${field} must not exceed 16384 serialized characters`);
  }
  return value as Record<string, unknown>;
}
