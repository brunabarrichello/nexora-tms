import { BadRequestException } from '@nestjs/common';

export interface CapacityReservationCancelInput {
  readonly reason: string;
}

export function parseCapacityReservationCancel(input: unknown): CapacityReservationCancelInput {
  if (!isRecord(input)) {
    throw new BadRequestException('Request body must be an object');
  }

  const reason = readRequiredString(input, 'reason', 1000);
  return { reason };
}

function readRequiredString(
  input: Record<string, unknown>,
  field: string,
  maxLength: number,
): string {
  const value = input[field];
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new BadRequestException(`${field} is required`);
  }
  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
