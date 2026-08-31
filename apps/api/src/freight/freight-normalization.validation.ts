import { BadRequestException } from '@nestjs/common';

export type MutablePatch = Readonly<Record<string, unknown>>;

const requirementTypes = new Set([
  'vehicle_type',
  'body_type',
  'tracking',
  'temperature_min',
  'temperature_max',
  'handling',
  'certification',
  'equipment',
  'insurance',
  'other',
]);
const referenceTypes = new Set([
  'customer_order',
  'purchase_order',
  'invoice',
  'shipment',
  'booking',
  'tracking',
  'external',
  'other',
]);

export function parseItemCreate(input: unknown): MutablePatch {
  const body = objectBody(input);
  return normalizeItem(body, true);
}

export function parseItemPatch(input: unknown): MutablePatch {
  const body = objectBody(input);
  return requirePatch(normalizeItem(body, false));
}

export function parsePackageCreate(input: unknown): MutablePatch {
  const body = objectBody(input);
  return normalizePackage(body, true);
}

export function parsePackagePatch(input: unknown): MutablePatch {
  const body = objectBody(input);
  return requirePatch(normalizePackage(body, false));
}

export function parseRequirementCreate(input: unknown): MutablePatch {
  const body = objectBody(input);
  return validateRequirement(normalizeRequirement(body, true));
}

export function parseRequirementPatch(input: unknown): MutablePatch {
  const body = objectBody(input);
  return requirePatch(normalizeRequirement(body, false));
}

export function parseReferenceCreate(input: unknown): MutablePatch {
  const body = objectBody(input);
  return normalizeReference(body, true);
}

export function parseReferencePatch(input: unknown): MutablePatch {
  const body = objectBody(input);
  return requirePatch(normalizeReference(body, false));
}

export function parseEventCreate(input: unknown): MutablePatch {
  const body = objectBody(input);
  return {
    eventType: text(body.eventType, 'eventType', 80),
    correlationId: optionalUuid(body.correlationId, 'correlationId'),
    payload: jsonObject(body.payload, 'payload', {}),
  };
}

export function parseLaneCreate(input: unknown): MutablePatch {
  const body = objectBody(input);
  return validateLane(normalizeLane(body, true));
}

export function parseLanePatch(input: unknown): MutablePatch {
  const body = objectBody(input);
  return requirePatch(normalizeLane(body, false));
}

export function requireWave0019Uuid(value: string, field = 'id'): string {
  if (!isUuid(value)) throw new BadRequestException(`${field} must be a valid UUID`);
  return value;
}

function normalizeItem(body: Record<string, unknown>, create: boolean): MutablePatch {
  const data: Record<string, unknown> = {};
  assign(data, body, 'sequence', (value) => positiveInteger(value, 'sequence'), create);
  assign(data, body, 'commodityId', (value) => optionalUuid(value, 'commodityId'));
  assign(data, body, 'cargoTypeId', (value) => optionalUuid(value, 'cargoTypeId'));
  assign(data, body, 'sku', (value) => optionalText(value, 'sku', 120));
  assign(data, body, 'description', (value) => text(value, 'description', 500), create);
  assign(data, body, 'quantity', (value) => positiveNumber(value, 'quantity'), false, create ? 1 : undefined);
  assign(data, body, 'unitOfMeasureId', (value) => optionalUuid(value, 'unitOfMeasureId'));
  assign(data, body, 'totalWeightKg', (value) => optionalPositiveNumber(value, 'totalWeightKg'));
  assign(data, body, 'totalVolumeM3', (value) => optionalPositiveNumber(value, 'totalVolumeM3'));
  assign(data, body, 'hazardous', (value) => booleanValue(value, 'hazardous'), false, create ? false : undefined);
  assign(data, body, 'minTemperatureC', (value) => optionalNumber(value, 'minTemperatureC'));
  assign(data, body, 'maxTemperatureC', (value) => optionalNumber(value, 'maxTemperatureC'));
  assign(data, body, 'stackable', (value) => optionalBoolean(value, 'stackable'));
  assign(data, body, 'notes', (value) => optionalText(value, 'notes', 1000));
  if (
    'minTemperatureC' in data &&
    'maxTemperatureC' in data &&
    data.minTemperatureC !== null &&
    data.maxTemperatureC !== null &&
    Number(data.minTemperatureC) > Number(data.maxTemperatureC)
  ) {
    throw new BadRequestException('minTemperatureC must be less than or equal to maxTemperatureC');
  }
  return data;
}

function normalizePackage(body: Record<string, unknown>, create: boolean): MutablePatch {
  const data: Record<string, unknown> = {};
  assign(data, body, 'itemId', (value) => optionalUuid(value, 'itemId'));
  assign(data, body, 'sequence', (value) => positiveInteger(value, 'sequence'), create);
  assign(data, body, 'packageTypeId', (value) => optionalUuid(value, 'packageTypeId'));
  assign(data, body, 'quantity', (value) => positiveInteger(value, 'quantity'), false, create ? 1 : undefined);
  assign(data, body, 'weightKg', (value) => optionalPositiveNumber(value, 'weightKg'));
  assign(data, body, 'lengthM', (value) => optionalPositiveNumber(value, 'lengthM'));
  assign(data, body, 'widthM', (value) => optionalPositiveNumber(value, 'widthM'));
  assign(data, body, 'heightM', (value) => optionalPositiveNumber(value, 'heightM'));
  assign(data, body, 'stackable', (value) => optionalBoolean(value, 'stackable'));
  assign(data, body, 'label', (value) => optionalText(value, 'label', 160));
  assign(data, body, 'barcode', (value) => optionalText(value, 'barcode', 160));
  assign(data, body, 'notes', (value) => optionalText(value, 'notes', 1000));
  const dimensions = ['lengthM', 'widthM', 'heightM'].filter((field) => field in data);
  if (dimensions.length > 0 && dimensions.length < 3) {
    throw new BadRequestException('lengthM, widthM and heightM must be provided together');
  }
  return data;
}

function normalizeRequirement(body: Record<string, unknown>, create: boolean): MutablePatch {
  const data: Record<string, unknown> = {};
  assign(data, body, 'code', (value) => text(value, 'code', 80).toUpperCase(), create);
  assign(
    data,
    body,
    'requirementType',
    (value) => enumValue(value, 'requirementType', requirementTypes),
    create,
  );
  assign(data, body, 'vehicleTypeId', (value) => optionalUuid(value, 'vehicleTypeId'));
  assign(data, body, 'bodyTypeId', (value) => optionalUuid(value, 'bodyTypeId'));
  assign(data, body, 'required', (value) => booleanValue(value, 'required'), false, create ? true : undefined);
  assign(data, body, 'valueText', (value) => optionalText(value, 'valueText', 500));
  assign(data, body, 'valueNumeric', (value) => optionalNumber(value, 'valueNumeric'));
  assign(data, body, 'valueBoolean', (value) => optionalBoolean(value, 'valueBoolean'));
  assign(data, body, 'metadata', (value) => jsonObject(value, 'metadata', {}), false, create ? {} : undefined);
  assign(data, body, 'notes', (value) => optionalText(value, 'notes', 1000));
  return data;
}

function validateRequirement(data: MutablePatch): MutablePatch {
  const type = data.requirementType;
  if (type === 'vehicle_type' && !data.vehicleTypeId) {
    throw new BadRequestException('vehicleTypeId is required for vehicle_type requirement');
  }
  if (type === 'body_type' && !data.bodyTypeId) {
    throw new BadRequestException('bodyTypeId is required for body_type requirement');
  }
  if (type === 'tracking' && typeof data.valueBoolean !== 'boolean') {
    throw new BadRequestException('valueBoolean is required for tracking requirement');
  }
  if ((type === 'temperature_min' || type === 'temperature_max') && data.valueNumeric === null) {
    throw new BadRequestException('valueNumeric is required for temperature requirement');
  }
  return data;
}

function normalizeReference(body: Record<string, unknown>, create: boolean): MutablePatch {
  const data: Record<string, unknown> = {};
  assign(data, body, 'referenceType', (value) => enumValue(value, 'referenceType', referenceTypes), create);
  assign(data, body, 'value', (value) => text(value, 'value', 180), create);
  assign(data, body, 'issuerPartyId', (value) => optionalUuid(value, 'issuerPartyId'));
  assign(data, body, 'metadata', (value) => jsonObject(value, 'metadata', {}), false, create ? {} : undefined);
  return data;
}

function normalizeLane(body: Record<string, unknown>, create: boolean): MutablePatch {
  const data: Record<string, unknown> = {};
  assign(data, body, 'code', (value) => text(value, 'code', 80).toUpperCase(), create);
  assign(data, body, 'name', (value) => text(value, 'name', 180), create);
  assign(data, body, 'originCityId', (value) => requiredUuid(value, 'originCityId'), create);
  assign(data, body, 'destinationCityId', (value) => requiredUuid(value, 'destinationCityId'), create);
  assign(data, body, 'originRadiusKm', (value) => optionalNonNegativeNumber(value, 'originRadiusKm'));
  assign(data, body, 'destinationRadiusKm', (value) => optionalNonNegativeNumber(value, 'destinationRadiusKm'));
  assign(data, body, 'distanceKm', (value) => optionalPositiveNumber(value, 'distanceKm'));
  assign(data, body, 'typicalTransitHours', (value) => optionalPositiveNumber(value, 'typicalTransitHours'));
  assign(data, body, 'isActive', (value) => booleanValue(value, 'isActive'), false, create ? true : undefined);
  return data;
}

function validateLane(data: MutablePatch): MutablePatch {
  if (data.originCityId && data.destinationCityId && data.originCityId === data.destinationCityId) {
    throw new BadRequestException('originCityId and destinationCityId must be different');
  }
  return data;
}

function assign(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  field: string,
  parser: (value: unknown) => unknown,
  required = false,
  fallback?: unknown,
): void {
  if (field in source) {
    target[field] = parser(source[field]);
    return;
  }
  if (required) throw new BadRequestException(`${field} is required`);
  if (fallback !== undefined) target[field] = fallback;
}

function requirePatch(data: MutablePatch): MutablePatch {
  if (Object.keys(data).length === 0) throw new BadRequestException('At least one field must be provided');
  return data;
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
  if (normalized.length > maxLength) throw new BadRequestException(`${field} is too long`);
  return normalized;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field, maxLength);
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new BadRequestException(`${field} must be a boolean`);
  return value;
}

function optionalBoolean(value: unknown, field: string): boolean | null {
  if (value === undefined || value === null || value === '') return null;
  return booleanValue(value, field);
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new BadRequestException(`${field} must be a positive integer`);
  return parsed;
}

function positiveNumber(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new BadRequestException(`${field} must be a positive number`);
  return parsed;
}

function optionalPositiveNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  return positiveNumber(value, field);
}

function optionalNonNegativeNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException(`${field} must be non-negative`);
  return parsed;
}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new BadRequestException(`${field} must be numeric`);
  return parsed;
}

function enumValue(value: unknown, field: string, values: ReadonlySet<string>): string {
  if (typeof value !== 'string' || !values.has(value)) throw new BadRequestException(`${field} is invalid`);
  return value;
}

function requiredUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isUuid(value)) throw new BadRequestException(`${field} must be a valid UUID`);
  return value;
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredUuid(value, field);
}

function jsonObject(value: unknown, field: string, fallback: Record<string, unknown>): Record<string, unknown> {
  if (value === undefined || value === null) return fallback;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
