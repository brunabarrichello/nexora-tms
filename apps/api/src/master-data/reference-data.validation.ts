import { BadRequestException } from '@nestjs/common';

export type ReferenceCatalogKind =
  | 'countries'
  | 'states'
  | 'cities'
  | 'unitsOfMeasure'
  | 'vehicleTypes'
  | 'bodyTypes'
  | 'cargoTypes'
  | 'packageTypes'
  | 'documentTypes'
  | 'tags';

export interface ReferenceListQuery {
  readonly q: string | null;
  readonly active: boolean | null;
  readonly limit: number;
  readonly offset: number;
  readonly countryId: string | null;
  readonly stateId: string | null;
  readonly dimension: string | null;
  readonly subjectScope: string | null;
}

const catalogBySlug: Readonly<Record<string, ReferenceCatalogKind>> = {
  countries: 'countries',
  states: 'states',
  cities: 'cities',
  'units-of-measure': 'unitsOfMeasure',
  'vehicle-types': 'vehicleTypes',
  'body-types': 'bodyTypes',
  'cargo-types': 'cargoTypes',
  'package-types': 'packageTypes',
  'document-types': 'documentTypes',
  tags: 'tags',
};

const tenantCatalogs = new Set<ReferenceCatalogKind>([
  'vehicleTypes',
  'bodyTypes',
  'cargoTypes',
  'packageTypes',
  'documentTypes',
  'tags',
]);

const dimensions = new Set(['mass', 'volume', 'length', 'count', 'time', 'other']);
const subjectScopes = new Set([
  'party',
  'driver',
  'asset',
  'request',
  'trip',
  'financial',
  'other',
]);

export function parseCatalogSlug(value: string): ReferenceCatalogKind {
  const catalog = catalogBySlug[value];
  if (!catalog) throw new BadRequestException('Reference catalog is invalid');
  return catalog;
}

export function isTenantCatalog(kind: ReferenceCatalogKind): boolean {
  return tenantCatalogs.has(kind);
}

export function parseReferenceListQuery(input: Record<string, unknown>): ReferenceListQuery {
  return {
    q: optionalText(input.q, 'q', 160),
    active: optionalBooleanQuery(input.active, 'active'),
    limit: integerQuery(input.limit, 'limit', 50, 1, 100),
    offset: integerQuery(input.offset, 'offset', 0, 0, 100_000),
    countryId: optionalUuid(input.countryId, 'countryId'),
    stateId: optionalUuid(input.stateId, 'stateId'),
    dimension: optionalEnum(input.dimension, 'dimension', dimensions),
    subjectScope: optionalEnum(input.subjectScope, 'subjectScope', subjectScopes),
  };
}

export function parseTenantCatalogCreate(
  kind: ReferenceCatalogKind,
  input: unknown,
): Record<string, unknown> {
  ensureTenantCatalog(kind);
  const body = objectBody(input);
  const data: Record<string, unknown> = {
    code: text(body.code, 'code', 80).toUpperCase(),
    name: text(body.name, 'name', 160),
    isActive: body.isActive === undefined ? true : booleanBody(body.isActive, 'isActive'),
  };

  if (kind !== 'documentTypes') {
    data.description = optionalText(body.description, 'description', 300);
  }

  addKindSpecificCreate(kind, body, data);
  return data;
}

export function parseTenantCatalogUpdate(
  kind: ReferenceCatalogKind,
  input: unknown,
): Record<string, unknown> {
  ensureTenantCatalog(kind);
  const body = objectBody(input);
  const patch: Record<string, unknown> = {};

  if ('code' in body) patch.code = text(body.code, 'code', 80).toUpperCase();
  if ('name' in body) patch.name = text(body.name, 'name', 160);
  if ('isActive' in body) patch.isActive = booleanBody(body.isActive, 'isActive');
  if (kind !== 'documentTypes' && 'description' in body) {
    patch.description = optionalText(body.description, 'description', 300);
  }

  addKindSpecificPatch(kind, body, patch);
  if (Object.keys(patch).length === 0) {
    throw new BadRequestException('At least one field must be provided');
  }
  return patch;
}

export function requireUuid(value: string, field = 'id'): string {
  if (!isUuid(value)) throw new BadRequestException(`${field} must be a valid UUID`);
  return value;
}

function addKindSpecificCreate(
  kind: ReferenceCatalogKind,
  body: Record<string, unknown>,
  data: Record<string, unknown>,
): void {
  switch (kind) {
    case 'vehicleTypes':
      data.defaultMaxWeightKg = optionalPositiveNumber(
        body.defaultMaxWeightKg,
        'defaultMaxWeightKg',
      );
      break;
    case 'bodyTypes':
      data.isClosed = body.isClosed === undefined ? false : booleanBody(body.isClosed, 'isClosed');
      data.supportsSideLoading =
        body.supportsSideLoading === undefined
          ? false
          : booleanBody(body.supportsSideLoading, 'supportsSideLoading');
      data.supportsRearLoading =
        body.supportsRearLoading === undefined
          ? false
          : booleanBody(body.supportsRearLoading, 'supportsRearLoading');
      break;
    case 'cargoTypes':
      data.requiresSpecialHandling =
        body.requiresSpecialHandling === undefined
          ? false
          : booleanBody(body.requiresSpecialHandling, 'requiresSpecialHandling');
      break;
    case 'packageTypes':
      data.stackableDefault = nullableBooleanBody(body.stackableDefault, 'stackableDefault');
      break;
    case 'documentTypes':
      data.subjectScope = requiredEnum(body.subjectScope, 'subjectScope', subjectScopes);
      data.hasExpiry =
        body.hasExpiry === undefined ? false : booleanBody(body.hasExpiry, 'hasExpiry');
      data.requiresValidation =
        body.requiresValidation === undefined
          ? false
          : booleanBody(body.requiresValidation, 'requiresValidation');
      break;
    case 'tags':
      break;
    default:
      throw new BadRequestException('Reference catalog is read-only');
  }
}

function addKindSpecificPatch(
  kind: ReferenceCatalogKind,
  body: Record<string, unknown>,
  patch: Record<string, unknown>,
): void {
  switch (kind) {
    case 'vehicleTypes':
      if ('defaultMaxWeightKg' in body) {
        patch.defaultMaxWeightKg = optionalPositiveNumber(
          body.defaultMaxWeightKg,
          'defaultMaxWeightKg',
        );
      }
      break;
    case 'bodyTypes':
      if ('isClosed' in body) patch.isClosed = booleanBody(body.isClosed, 'isClosed');
      if ('supportsSideLoading' in body) {
        patch.supportsSideLoading = booleanBody(body.supportsSideLoading, 'supportsSideLoading');
      }
      if ('supportsRearLoading' in body) {
        patch.supportsRearLoading = booleanBody(body.supportsRearLoading, 'supportsRearLoading');
      }
      break;
    case 'cargoTypes':
      if ('requiresSpecialHandling' in body) {
        patch.requiresSpecialHandling = booleanBody(
          body.requiresSpecialHandling,
          'requiresSpecialHandling',
        );
      }
      break;
    case 'packageTypes':
      if ('stackableDefault' in body) {
        patch.stackableDefault = nullableBooleanBody(body.stackableDefault, 'stackableDefault');
      }
      break;
    case 'documentTypes':
      if ('subjectScope' in body) {
        patch.subjectScope = requiredEnum(body.subjectScope, 'subjectScope', subjectScopes);
      }
      if ('hasExpiry' in body) patch.hasExpiry = booleanBody(body.hasExpiry, 'hasExpiry');
      if ('requiresValidation' in body) {
        patch.requiresValidation = booleanBody(body.requiresValidation, 'requiresValidation');
      }
      break;
    case 'tags':
      break;
    default:
      throw new BadRequestException('Reference catalog is read-only');
  }
}

function ensureTenantCatalog(kind: ReferenceCatalogKind): void {
  if (!isTenantCatalog(kind)) throw new BadRequestException('Reference catalog is read-only');
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

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field, maxLength);
}

function booleanBody(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new BadRequestException(`${field} must be a boolean`);
  return value;
}

function nullableBooleanBody(value: unknown, field: string): boolean | null {
  if (value === undefined || value === null) return null;
  return booleanBody(value, field);
}

function optionalPositiveNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestException(`${field} must be a positive number`);
  }
  return parsed;
}

function integerQuery(
  value: unknown,
  field: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(`${field} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function optionalBooleanQuery(value: unknown, field: string): boolean | null {
  if (value === undefined || value === null || value === '') return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  throw new BadRequestException(`${field} must be true or false`);
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || !isUuid(raw)) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return raw;
}

function optionalEnum(value: unknown, field: string, values: ReadonlySet<string>): string | null {
  if (value === undefined || value === null || value === '') return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || !values.has(raw)) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return raw;
}

function requiredEnum(value: unknown, field: string, values: ReadonlySet<string>): string {
  if (typeof value !== 'string' || !values.has(value)) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
