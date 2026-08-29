import { BadRequestException } from '@nestjs/common';

export type CapacityAssignmentStatus = 'active' | 'ended' | 'cancelled';

export interface CapacityAssignmentInput {
  readonly driverId: string;
  readonly vehicleId: string;
  readonly carrierPartyId: string;
  readonly startsAt: string | null;
}

export interface CapacityAssignmentCloseInput {
  readonly status: 'ended' | 'cancelled';
  readonly endsAt: string | null;
  readonly statusReason: string | null;
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
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

function uuid(value: unknown, field: string): string {
  const normalized = text(value, field, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
  ) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return normalized;
}

function optionalTimestamp(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  const normalized = text(value, field, 64);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} must be a valid ISO timestamp`);
  }
  return parsed.toISOString();
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field, maxLength);
}

export function parseCreateCapacityAssignment(input: unknown): CapacityAssignmentInput {
  const body = objectBody(input);
  return {
    driverId: uuid(body.driverId, 'driverId'),
    vehicleId: uuid(body.vehicleId, 'vehicleId'),
    carrierPartyId: uuid(body.carrierPartyId, 'carrierPartyId'),
    startsAt: optionalTimestamp(body.startsAt, 'startsAt'),
  };
}

export function parseCloseCapacityAssignment(input: unknown): CapacityAssignmentCloseInput {
  const body = objectBody(input);
  const status = body.status;
  if (status !== 'ended' && status !== 'cancelled') {
    throw new BadRequestException('status must be ended or cancelled');
  }
  const statusReason = optionalText(body.statusReason, 'statusReason', 500);
  if (status === 'cancelled' && !statusReason) {
    throw new BadRequestException('statusReason is required when cancelling an assignment');
  }
  return {
    status,
    endsAt: optionalTimestamp(body.endsAt, 'endsAt'),
    statusReason,
  };
}

export function validateAssignmentPeriod(startsAt: Date, endsAt: Date): void {
  if (endsAt.getTime() < startsAt.getTime()) {
    throw new BadRequestException('endsAt must be greater than or equal to startsAt');
  }
}
