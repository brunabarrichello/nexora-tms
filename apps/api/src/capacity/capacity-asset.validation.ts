import { BadRequestException } from '@nestjs/common';

export type CapacityAssetKind = 'vehicle' | 'implement';
export type CapacityAssetStatus = 'active' | 'blocked' | 'inactive';

export interface CapacityAssetInput {
  readonly carrierPartyId: string | null;
  readonly ownerPartyId: string | null;
  readonly ownerName: string | null;
  readonly assetKind: CapacityAssetKind;
  readonly identifier: string;
  readonly plate: string | null;
  readonly vehicleType: string;
  readonly bodyType: string;
  readonly capacityWeightKg: number;
  readonly capacityVolumeM3: number | null;
  readonly maxLengthM: number | null;
  readonly maxWidthM: number | null;
  readonly maxHeightM: number | null;
  readonly trackingAvailable: boolean;
  readonly status: CapacityAssetStatus;
  readonly statusReason: string | null;
}

export interface CapacityAssetPatch {
  carrierPartyId?: string | null;
  ownerPartyId?: string | null;
  ownerName?: string | null;
  assetKind?: CapacityAssetKind;
  identifier?: string;
  plate?: string | null;
  vehicleType?: string;
  bodyType?: string;
  capacityWeightKg?: number;
  capacityVolumeM3?: number | null;
  maxLengthM?: number | null;
  maxWidthM?: number | null;
  maxHeightM?: number | null;
  trackingAvailable?: boolean;
  status?: CapacityAssetStatus;
  statusReason?: string | null;
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maxLength: number, minLength = 1): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a string`);
  const normalized = value.trim();
  if (normalized.length < minLength) throw new BadRequestException(`${field} is required`);
  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} must contain at most ${maxLength} characters`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field, maxLength);
}

function uuidOrNull(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  const normalized = text(value, field, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
  ) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return normalized;
}

function plateOrNull(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const normalized = text(value, 'plate', 12)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!/^([A-Z]{3}[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2})$/.test(normalized)) {
    throw new BadRequestException('plate must be a valid Brazilian legacy or Mercosul plate');
  }
  return normalized;
}

function positiveNumber(value: unknown, field: string, optional = false): number | null {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new BadRequestException(`${field} must be a positive number`);
  }
  return value;
}

function booleanValue(value: unknown, field: string, defaultValue?: boolean): boolean {
  if (value === undefined && defaultValue !== undefined) return defaultValue;
  if (typeof value !== 'boolean') throw new BadRequestException(`${field} must be a boolean`);
  return value;
}

function assetKind(value: unknown): CapacityAssetKind {
  if (value === 'vehicle' || value === 'implement') return value;
  throw new BadRequestException('assetKind must be vehicle or implement');
}

function status(value: unknown): CapacityAssetStatus {
  if (value === undefined) return 'inactive';
  if (value === 'active' || value === 'blocked' || value === 'inactive') return value;
  throw new BadRequestException('status must be active, blocked or inactive');
}

function validateOwnership(
  carrierPartyId: string | null,
  ownerPartyId: string | null,
  ownerName: string | null,
): void {
  if (!carrierPartyId && !ownerPartyId && !ownerName) {
    throw new BadRequestException('carrierPartyId, ownerPartyId or ownerName is required');
  }
}

function validateDimensions(
  maxLengthM: number | null,
  maxWidthM: number | null,
  maxHeightM: number | null,
): void {
  const provided = [maxLengthM, maxWidthM, maxHeightM].filter((value) => value !== null).length;
  if (provided !== 0 && provided !== 3) {
    throw new BadRequestException('maxLengthM, maxWidthM and maxHeightM must be informed together');
  }
}

export function validateCapacityAssetState(
  statusValue: CapacityAssetStatus,
  statusReason: string | null,
): void {
  if (statusValue === 'blocked' && !statusReason) {
    throw new BadRequestException('statusReason is required when status is blocked');
  }
}

export function parseCreateCapacityAsset(input: unknown): CapacityAssetInput {
  const body = objectBody(input);
  const carrierPartyId = uuidOrNull(body.carrierPartyId, 'carrierPartyId');
  const ownerPartyId = uuidOrNull(body.ownerPartyId, 'ownerPartyId');
  const ownerName = optionalText(body.ownerName, 'ownerName', 180);
  const maxLengthM = positiveNumber(body.maxLengthM, 'maxLengthM', true);
  const maxWidthM = positiveNumber(body.maxWidthM, 'maxWidthM', true);
  const maxHeightM = positiveNumber(body.maxHeightM, 'maxHeightM', true);
  const assetStatus = status(body.status);
  const statusReason = optionalText(body.statusReason, 'statusReason', 500);

  validateOwnership(carrierPartyId, ownerPartyId, ownerName);
  validateDimensions(maxLengthM, maxWidthM, maxHeightM);
  validateCapacityAssetState(assetStatus, statusReason);

  return {
    carrierPartyId,
    ownerPartyId,
    ownerName,
    assetKind: assetKind(body.assetKind),
    identifier: text(body.identifier, 'identifier', 64, 2).toUpperCase(),
    plate: plateOrNull(body.plate),
    vehicleType: text(body.vehicleType, 'vehicleType', 80, 2).toLowerCase(),
    bodyType: text(body.bodyType, 'bodyType', 80, 2).toLowerCase(),
    capacityWeightKg: positiveNumber(body.capacityWeightKg, 'capacityWeightKg')!,
    capacityVolumeM3: positiveNumber(body.capacityVolumeM3, 'capacityVolumeM3', true),
    maxLengthM,
    maxWidthM,
    maxHeightM,
    trackingAvailable: booleanValue(body.trackingAvailable, 'trackingAvailable', false),
    status: assetStatus,
    statusReason,
  };
}

export function parseUpdateCapacityAsset(input: unknown): CapacityAssetPatch {
  const body = objectBody(input);
  const patch: CapacityAssetPatch = {};
  if ('carrierPartyId' in body)
    patch.carrierPartyId = uuidOrNull(body.carrierPartyId, 'carrierPartyId');
  if ('ownerPartyId' in body) patch.ownerPartyId = uuidOrNull(body.ownerPartyId, 'ownerPartyId');
  if ('ownerName' in body) patch.ownerName = optionalText(body.ownerName, 'ownerName', 180);
  if ('assetKind' in body) patch.assetKind = assetKind(body.assetKind);
  if ('identifier' in body)
    patch.identifier = text(body.identifier, 'identifier', 64, 2).toUpperCase();
  if ('plate' in body) patch.plate = plateOrNull(body.plate);
  if ('vehicleType' in body)
    patch.vehicleType = text(body.vehicleType, 'vehicleType', 80, 2).toLowerCase();
  if ('bodyType' in body) patch.bodyType = text(body.bodyType, 'bodyType', 80, 2).toLowerCase();
  if ('capacityWeightKg' in body)
    patch.capacityWeightKg = positiveNumber(body.capacityWeightKg, 'capacityWeightKg')!;
  if ('capacityVolumeM3' in body)
    patch.capacityVolumeM3 = positiveNumber(body.capacityVolumeM3, 'capacityVolumeM3', true);
  if ('maxLengthM' in body) patch.maxLengthM = positiveNumber(body.maxLengthM, 'maxLengthM', true);
  if ('maxWidthM' in body) patch.maxWidthM = positiveNumber(body.maxWidthM, 'maxWidthM', true);
  if ('maxHeightM' in body) patch.maxHeightM = positiveNumber(body.maxHeightM, 'maxHeightM', true);
  if ('trackingAvailable' in body)
    patch.trackingAvailable = booleanValue(body.trackingAvailable, 'trackingAvailable');
  if ('status' in body) patch.status = status(body.status);
  if ('statusReason' in body)
    patch.statusReason = optionalText(body.statusReason, 'statusReason', 500);
  if (Object.keys(patch).length === 0)
    throw new BadRequestException('At least one field must be provided');
  return patch;
}

export function validateCapacityAssetOwnership(
  carrierPartyId: string | null,
  ownerPartyId: string | null,
  ownerName: string | null,
): void {
  validateOwnership(carrierPartyId, ownerPartyId, ownerName);
}

export function validateCapacityAssetDimensions(
  maxLengthM: number | null,
  maxWidthM: number | null,
  maxHeightM: number | null,
): void {
  validateDimensions(maxLengthM, maxWidthM, maxHeightM);
}
