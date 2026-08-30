import { BadRequestException } from '@nestjs/common';

import { requireUuid } from './business-party.validation.js';

export type CustomFieldEntityType =
  'business_party' | 'driver' | 'capacity_asset' | 'transport_request' | 'location';
export type TaggedEntityType = Exclude<CustomFieldEntityType, 'location'>;
export type CustomFieldDataType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'json';

const customFieldEntityTypes = new Set<CustomFieldEntityType>([
  'business_party',
  'driver',
  'capacity_asset',
  'transport_request',
  'location',
]);
const taggedEntityTypes = new Set<TaggedEntityType>([
  'business_party',
  'driver',
  'capacity_asset',
  'transport_request',
]);
const customFieldDataTypes = new Set<CustomFieldDataType>([
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'json',
]);
const locationTypes = new Set([
  'customer',
  'shipper',
  'consignee',
  'terminal',
  'warehouse',
  'yard',
  'port',
  'airport',
  'border',
  'support',
  'other',
]);
const groupTypes = new Set(['economic', 'commercial', 'operational', 'risk', 'other']);

function requireObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Request body must be an object');
  }
  return input as Record<string, unknown>;
}

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new BadRequestException(`${field} must contain between 1 and ${maxLength} characters`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field, maxLength);
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a UUID or null`);
  return requireUuid(value, field);
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new BadRequestException(`${field} must be a boolean`);
  return value;
}

function optionalNumber(value: unknown, field: string, min: number, max?: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    (max !== undefined && value > max)
  ) {
    throw new BadRequestException(
      `${field} must be a finite number between ${min}${max === undefined ? '' : ` and ${max}`}`,
    );
  }
  return value;
}

export interface LocationInput {
  code: string;
  name: string;
  type: string;
  partyId: string | null;
  addressId: string | null;
  cityId: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  operationalReference: string | null;
  isActive: boolean;
}

export function parseLocation(input: unknown): LocationInput {
  const body = requireObject(input);
  const type = text(body.type, 'type', 32);
  if (!locationTypes.has(type))
    throw new BadRequestException('type is not a supported location type');
  const partyId = optionalUuid(body.partyId, 'partyId');
  const addressId = optionalUuid(body.addressId, 'addressId');
  if ((partyId === null) !== (addressId === null)) {
    throw new BadRequestException('partyId and addressId must be provided together');
  }
  const latitude = optionalNumber(body.latitude, 'latitude', -90, 90);
  const longitude = optionalNumber(body.longitude, 'longitude', -180, 180);
  if ((latitude === null) !== (longitude === null)) {
    throw new BadRequestException('latitude and longitude must be provided together');
  }
  const cityId = optionalUuid(body.cityId, 'cityId');
  const street = optionalText(body.street, 'street', 200);
  if (!addressId && (!cityId || !street)) {
    throw new BadRequestException('standalone locations require cityId and street');
  }
  return {
    code: text(body.code, 'code', 80),
    name: text(body.name, 'name', 200),
    type,
    partyId,
    addressId,
    cityId,
    postalCode: optionalText(body.postalCode, 'postalCode', 16),
    street,
    number: optionalText(body.number, 'number', 40),
    complement: optionalText(body.complement, 'complement', 160),
    district: optionalText(body.district, 'district', 120),
    latitude,
    longitude,
    operationalReference: optionalText(body.operationalReference, 'operationalReference', 500),
    isActive: optionalBoolean(body.isActive, 'isActive') ?? true,
  };
}

export interface DimensionInput {
  organizationId: string;
  businessUnitId: string | null;
  code: string;
  name: string;
  isActive: boolean;
}

export function parseDimension(input: unknown): DimensionInput {
  const body = requireObject(input);
  return {
    organizationId: requireUuid(text(body.organizationId, 'organizationId', 36), 'organizationId'),
    businessUnitId: optionalUuid(body.businessUnitId, 'businessUnitId'),
    code: text(body.code, 'code', 80),
    name: text(body.name, 'name', 160),
    isActive: optionalBoolean(body.isActive, 'isActive') ?? true,
  };
}

export interface CommodityInput {
  code: string;
  name: string;
  description: string | null;
  defaultCargoTypeId: string | null;
  isHazardous: boolean;
  requiresTemperatureControl: boolean;
  isActive: boolean;
}

export function parseCommodity(input: unknown): CommodityInput {
  const body = requireObject(input);
  return {
    code: text(body.code, 'code', 80),
    name: text(body.name, 'name', 160),
    description: optionalText(body.description, 'description', 500),
    defaultCargoTypeId: optionalUuid(body.defaultCargoTypeId, 'defaultCargoTypeId'),
    isHazardous: optionalBoolean(body.isHazardous, 'isHazardous') ?? false,
    requiresTemperatureControl:
      optionalBoolean(body.requiresTemperatureControl, 'requiresTemperatureControl') ?? false,
    isActive: optionalBoolean(body.isActive, 'isActive') ?? true,
  };
}

export interface PartyGroupInput {
  code: string;
  name: string;
  groupType: string;
  isActive: boolean;
}

export function parsePartyGroup(input: unknown): PartyGroupInput {
  const body = requireObject(input);
  const groupType = text(body.groupType, 'groupType', 32);
  if (!groupTypes.has(groupType)) throw new BadRequestException('groupType is not supported');
  return {
    code: text(body.code, 'code', 80),
    name: text(body.name, 'name', 200),
    groupType,
    isActive: optionalBoolean(body.isActive, 'isActive') ?? true,
  };
}

export interface PartyRequirementInput {
  requirementType: string;
  value: unknown;
  isMandatory: boolean;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

function optionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  const normalized = text(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new BadRequestException(`${field} must use YYYY-MM-DD`);
  }
  return normalized;
}

export function parsePartyRequirement(input: unknown): PartyRequirementInput {
  const body = requireObject(input);
  const mandatory = optionalBoolean(body.isMandatory, 'isMandatory') ?? true;
  if (mandatory && body.value === undefined) {
    throw new BadRequestException('value is required when isMandatory is true');
  }
  return {
    requirementType: text(body.requirementType, 'requirementType', 64),
    value: body.value ?? null,
    isMandatory: mandatory,
    validFrom: optionalDate(body.validFrom, 'validFrom'),
    validUntil: optionalDate(body.validUntil, 'validUntil'),
    isActive: optionalBoolean(body.isActive, 'isActive') ?? true,
  };
}

export interface CustomFieldDefinitionInput {
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  dataType: CustomFieldDataType;
  isRequired: boolean;
  validation: Record<string, unknown> | null;
  isActive: boolean;
}

export function parseCustomFieldDefinition(input: unknown): CustomFieldDefinitionInput {
  const body = requireObject(input);
  const entityType = text(body.entityType, 'entityType', 64) as CustomFieldEntityType;
  const dataType = text(body.dataType, 'dataType', 32) as CustomFieldDataType;
  if (!customFieldEntityTypes.has(entityType)) {
    throw new BadRequestException('entityType is not supported for custom fields');
  }
  if (!customFieldDataTypes.has(dataType)) {
    throw new BadRequestException('dataType is not supported');
  }
  if (
    body.validation !== undefined &&
    body.validation !== null &&
    (typeof body.validation !== 'object' || Array.isArray(body.validation))
  ) {
    throw new BadRequestException('validation must be an object or null');
  }
  return {
    entityType,
    key: text(body.key, 'key', 120),
    label: text(body.label, 'label', 160),
    dataType,
    isRequired: optionalBoolean(body.isRequired, 'isRequired') ?? false,
    validation: (body.validation as Record<string, unknown> | null | undefined) ?? null,
    isActive: optionalBoolean(body.isActive, 'isActive') ?? true,
  };
}

export function requireCustomFieldEntityType(value: string): CustomFieldEntityType {
  if (!customFieldEntityTypes.has(value as CustomFieldEntityType)) {
    throw new BadRequestException('entityType is not supported for custom fields');
  }
  return value as CustomFieldEntityType;
}

export function requireTaggedEntityType(value: string): TaggedEntityType {
  if (!taggedEntityTypes.has(value as TaggedEntityType)) {
    throw new BadRequestException('entityType is not supported for tags');
  }
  return value as TaggedEntityType;
}

export function validateCustomFieldValue(dataType: CustomFieldDataType, value: unknown): unknown {
  switch (dataType) {
    case 'string':
      if (typeof value !== 'string')
        throw new BadRequestException('custom field value must be a string');
      return value;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new BadRequestException('custom field value must be a finite number');
      }
      return value;
    case 'boolean':
      if (typeof value !== 'boolean')
        throw new BadRequestException('custom field value must be a boolean');
      return value;
    case 'date':
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new BadRequestException('custom field value must use YYYY-MM-DD');
      }
      return value;
    case 'datetime':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        throw new BadRequestException('custom field value must be an ISO-compatible datetime');
      }
      return value;
    case 'json':
      if (value === undefined) throw new BadRequestException('custom field value is required');
      return value;
  }
}
