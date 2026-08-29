import { BadRequestException } from '@nestjs/common';

export interface TransportCargoProfileInput {
  readonly material: string;
  readonly cargoType: string;
  readonly totalWeightKg: number;
  readonly volumeCount: number;
  readonly palletCount: number;
  readonly cubageM3: number | null;
  readonly maxLengthM: number | null;
  readonly maxWidthM: number | null;
  readonly maxHeightM: number | null;
  readonly trackingRequired: boolean;
  readonly vehicleType: string;
  readonly bodyType: string;
  readonly nonStackable: boolean;
  readonly specialCargo: boolean;
  readonly specialInstructions: string | null;
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
  }
  return value as Record<string, unknown>;
}

function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new BadRequestException(`${field} is required`);
  }
  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} must contain at most ${maxLength} characters`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} must contain at most ${maxLength} characters`);
  }
  return normalized || null;
}

function requirePositiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new BadRequestException(`${field} must be a positive number`);
  }
  return value;
}

function optionalPositiveNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  return requirePositiveNumber(value, field);
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (value === undefined || value === null) return 0;
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new BadRequestException(`${field} must be a non-negative integer`);
  }
  return value as number;
}

function optionalBoolean(value: unknown, field: string): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${field} must be a boolean`);
  }
  return value;
}

export function parseTransportCargoProfile(input: unknown): TransportCargoProfileInput {
  const body = requireObject(input);
  const volumeCount = nonNegativeInteger(body.volumeCount, 'volumeCount');
  const palletCount = nonNegativeInteger(body.palletCount, 'palletCount');
  if (volumeCount === 0 && palletCount === 0) {
    throw new BadRequestException('At least one volume or pallet must be informed');
  }

  const maxLengthM = optionalPositiveNumber(body.maxLengthM, 'maxLengthM');
  const maxWidthM = optionalPositiveNumber(body.maxWidthM, 'maxWidthM');
  const maxHeightM = optionalPositiveNumber(body.maxHeightM, 'maxHeightM');
  const informedDimensions = [maxLengthM, maxWidthM, maxHeightM].filter(
    (value) => value !== null,
  ).length;
  if (informedDimensions !== 0 && informedDimensions !== 3) {
    throw new BadRequestException(
      'maxLengthM, maxWidthM and maxHeightM must be informed together',
    );
  }

  const specialCargo = optionalBoolean(body.specialCargo, 'specialCargo');
  const specialInstructions = optionalText(body.specialInstructions, 'specialInstructions', 1000);
  if (specialCargo && !specialInstructions) {
    throw new BadRequestException('specialInstructions is required when specialCargo is true');
  }

  return {
    material: requireText(body.material, 'material', 200),
    cargoType: requireText(body.cargoType, 'cargoType', 120),
    totalWeightKg: requirePositiveNumber(body.totalWeightKg, 'totalWeightKg'),
    volumeCount,
    palletCount,
    cubageM3: optionalPositiveNumber(body.cubageM3, 'cubageM3'),
    maxLengthM,
    maxWidthM,
    maxHeightM,
    trackingRequired: optionalBoolean(body.trackingRequired, 'trackingRequired'),
    vehicleType: requireText(body.vehicleType, 'vehicleType', 80),
    bodyType: requireText(body.bodyType, 'bodyType', 80),
    nonStackable: optionalBoolean(body.nonStackable, 'nonStackable'),
    specialCargo,
    specialInstructions,
  };
}
