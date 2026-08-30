import { BadRequestException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';

export type TripStatusTransition = 'ready' | 'in_transit' | 'completed' | 'cancelled';
export type TripStopType = 'pickup' | 'delivery' | 'support';
export type TripDriverRole = 'primary' | 'secondary' | 'relief';
export type TripAssetRole = 'tractor' | 'vehicle' | 'implement' | 'support';

export interface TripCreateInput {
  readonly code: string;
  readonly contractIds: readonly string[];
  readonly plannedStartAt: string;
  readonly plannedEndAt: string | null;
  readonly originLocationId: string | null;
  readonly destinationLocationId: string | null;
  readonly notes: string | null;
}

export interface TripStatusInput {
  readonly status: TripStatusTransition;
  readonly reason: string | null;
}

export interface TripRequestLinkInput {
  readonly contractId: string;
  readonly sequence: number;
}

export interface TripStopCreateInput {
  readonly sequence: number;
  readonly type: TripStopType;
  readonly locationId: string | null;
  readonly sourceTransportRequestId: string | null;
  readonly sourceTransportRequestStopId: string | null;
  readonly plannedArrivalAt: string | null;
  readonly plannedDepartureAt: string | null;
  readonly instructions: string | null;
}

export interface TripDriverCreateInput {
  readonly driverId: string;
  readonly role: TripDriverRole;
  readonly startsAt: string | null;
}

export interface TripAssetCreateInput {
  readonly assetId: string;
  readonly role: TripAssetRole;
  readonly startsAt: string | null;
}

const transitions = new Set<TripStatusTransition>([
  'ready',
  'in_transit',
  'completed',
  'cancelled',
]);
const stopTypes = new Set<TripStopType>(['pickup', 'delivery', 'support']);
const driverRoles = new Set<TripDriverRole>(['primary', 'secondary', 'relief']);
const assetRoles = new Set<TripAssetRole>(['tractor', 'vehicle', 'implement', 'support']);

export function parseTripCreate(input: unknown): TripCreateInput {
  const body = requireRecord(input);
  const code = requireTrimmedString(body.code, 'code', 80);
  const contractIds = requireUuidArray(body.contractIds, 'contractIds', 50);
  const plannedStartAt = requireTimestamp(body.plannedStartAt, 'plannedStartAt');
  const plannedEndAt = optionalTimestamp(body.plannedEndAt, 'plannedEndAt');
  const originLocationId = optionalUuid(body.originLocationId, 'originLocationId');
  const destinationLocationId = optionalUuid(body.destinationLocationId, 'destinationLocationId');
  const notes = optionalTrimmedString(body.notes, 'notes', 1000);

  if (plannedEndAt && Date.parse(plannedEndAt) < Date.parse(plannedStartAt)) {
    throw new BadRequestException('plannedEndAt must be on or after plannedStartAt');
  }
  if (originLocationId && destinationLocationId && originLocationId === destinationLocationId) {
    throw new BadRequestException('originLocationId and destinationLocationId must be different');
  }

  return {
    code,
    contractIds,
    plannedStartAt,
    plannedEndAt,
    originLocationId,
    destinationLocationId,
    notes,
  };
}

export function parseTripStatus(input: unknown): TripStatusInput {
  const body = requireRecord(input);
  const status = requireEnum(body.status, 'status', transitions);
  const reason = optionalTrimmedString(body.reason, 'reason', 1000);
  if (status === 'cancelled' && !reason) {
    throw new BadRequestException('reason is required when cancelling a trip');
  }
  return { status, reason };
}

export function parseTripRequestLink(input: unknown): TripRequestLinkInput {
  const body = requireRecord(input);
  return {
    contractId: requireUuidValue(body.contractId, 'contractId'),
    sequence: requirePositiveInteger(body.sequence, 'sequence'),
  };
}

export function parseTripStopCreate(input: unknown): TripStopCreateInput {
  const body = requireRecord(input);
  const sequence = requirePositiveInteger(body.sequence, 'sequence');
  const type = requireEnum(body.type, 'type', stopTypes);
  const locationId = optionalUuid(body.locationId, 'locationId');
  const sourceTransportRequestId = optionalUuid(
    body.sourceTransportRequestId,
    'sourceTransportRequestId',
  );
  const sourceTransportRequestStopId = optionalUuid(
    body.sourceTransportRequestStopId,
    'sourceTransportRequestStopId',
  );
  const plannedArrivalAt = optionalTimestamp(body.plannedArrivalAt, 'plannedArrivalAt');
  const plannedDepartureAt = optionalTimestamp(body.plannedDepartureAt, 'plannedDepartureAt');
  const instructions = optionalTrimmedString(body.instructions, 'instructions', 1000);

  if (Boolean(sourceTransportRequestId) !== Boolean(sourceTransportRequestStopId)) {
    throw new BadRequestException(
      'sourceTransportRequestId and sourceTransportRequestStopId must be provided together',
    );
  }
  if (!locationId && !sourceTransportRequestStopId) {
    throw new BadRequestException('locationId or a source transport-request stop is required');
  }
  if (
    plannedArrivalAt &&
    plannedDepartureAt &&
    Date.parse(plannedDepartureAt) < Date.parse(plannedArrivalAt)
  ) {
    throw new BadRequestException('plannedDepartureAt must be on or after plannedArrivalAt');
  }

  return {
    sequence,
    type,
    locationId,
    sourceTransportRequestId,
    sourceTransportRequestStopId,
    plannedArrivalAt,
    plannedDepartureAt,
    instructions,
  };
}

export function parseTripDriverCreate(input: unknown): TripDriverCreateInput {
  const body = requireRecord(input);
  return {
    driverId: requireUuidValue(body.driverId, 'driverId'),
    role: requireEnum(body.role, 'role', driverRoles),
    startsAt: optionalTimestamp(body.startsAt, 'startsAt'),
  };
}

export function parseTripAssetCreate(input: unknown): TripAssetCreateInput {
  const body = requireRecord(input);
  return {
    assetId: requireUuidValue(body.assetId, 'assetId'),
    role: requireEnum(body.role, 'role', assetRoles),
    startsAt: optionalTimestamp(body.startsAt, 'startsAt'),
  };
}

export function parseTripReason(input: unknown): string {
  const body = requireRecord(input);
  return requireTrimmedString(body.reason, 'reason', 1000);
}

function requireRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BadRequestException('Request body must be an object');
  }
  return input as Record<string, unknown>;
}

function requireTrimmedString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} is required`);
  const normalized = value.trim();
  if (!normalized) throw new BadRequestException(`${field} is required`);
  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} must not exceed ${maxLength} characters`);
  }
  return normalized;
}

function optionalTrimmedString(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireTrimmedString(value, field, maxLength);
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return value as number;
}

function requireEnum<T extends string>(value: unknown, field: string, allowed: Set<T>): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return value as T;
}

function requireUuidValue(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a UUID`);
  return requireUuid(value, field);
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireUuidValue(value, field);
}

function requireUuidArray(value: unknown, field: string, maxItems: number): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException(`${field} must contain at least one UUID`);
  }
  if (value.length > maxItems) {
    throw new BadRequestException(`${field} must not contain more than ${maxItems} items`);
  }
  const normalized = value.map((item, index) => requireUuidValue(item, `${field}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new BadRequestException(`${field} must not contain duplicate UUIDs`);
  }
  return normalized;
}

function requireTimestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${field} is required`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new BadRequestException(`${field} must be a valid timestamp`);
  return new Date(parsed).toISOString();
}

function optionalTimestamp(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireTimestamp(value, field);
}
