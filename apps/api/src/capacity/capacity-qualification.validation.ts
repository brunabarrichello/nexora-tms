import { BadRequestException } from '@nestjs/common';

export interface AvailabilityInput {
  readonly status: string;
  readonly availableFrom: string | null;
  readonly availableUntil: string | null;
  readonly currentCityId: string | null;
  readonly destinationCityId: string | null;
  readonly maxDistanceKm: number | null;
  readonly notes: string | null;
}

export interface DocumentRegisterInput {
  readonly documentTypeId: string;
  readonly documentNumber: string | null;
  readonly issuer: string | null;
  readonly issuedOn: string | null;
  readonly expiresOn: string | null;
  readonly status: string;
  readonly validationStatus: string;
  readonly notes: string | null;
}

export interface QualificationInput {
  readonly qualificationType: string;
  readonly code: string;
  readonly name: string;
  readonly certificateNumber: string | null;
  readonly issuer: string | null;
  readonly issuedOn: string | null;
  readonly expiresOn: string | null;
  readonly status: string;
  readonly notes: string | null;
}

export interface CourseInput {
  readonly courseCode: string;
  readonly courseName: string;
  readonly provider: string | null;
  readonly certificateNumber: string | null;
  readonly completedOn: string;
  readonly expiresOn: string | null;
  readonly workloadHours: number | null;
  readonly status: string;
  readonly notes: string | null;
}

export interface UnavailabilityInput {
  readonly reasonCode: string;
  readonly reason: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: string;
}

export interface EmergencyContactInput {
  readonly name: string;
  readonly relationship: string | null;
  readonly phone: string;
  readonly isPrimary: boolean;
  readonly isActive: boolean;
}

export interface BlockInput {
  readonly reasonCode: string;
  readonly reason: string;
  readonly severity: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
}

export interface ReleaseBlockInput {
  readonly releaseReason: string;
}

export interface RatingInput {
  readonly transportRequestId: string | null;
  readonly dimension: string;
  readonly score: number;
  readonly note: string | null;
}

export interface AssetCapabilitiesInput {
  readonly refrigerated: boolean;
  readonly sealed: boolean;
  readonly sideLoading: boolean;
  readonly rearLoading: boolean;
  readonly dangerousGoods: boolean;
  readonly foodGrade: boolean;
  readonly trackingCapable: boolean;
  readonly maxPallets: number | null;
  readonly minTemperatureC: number | null;
  readonly maxTemperatureC: number | null;
}

export interface MaintenancePlanInput {
  readonly name: string;
  readonly maintenanceType: string;
  readonly intervalDays: number | null;
  readonly intervalOdometerKm: number | null;
  readonly nextDueOn: string | null;
  readonly nextDueOdometerKm: number | null;
  readonly isActive: boolean;
  readonly notes: string | null;
}

export interface MaintenanceInput {
  readonly maintenancePlanId: string | null;
  readonly providerPartyId: string | null;
  readonly maintenanceType: string;
  readonly status: string;
  readonly plannedAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly odometerKm: number | null;
  readonly totalCost: number | null;
  readonly currencyId: string | null;
  readonly notes: string | null;
}

export interface MaintenanceItemInput {
  readonly itemType: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitAmount: number | null;
  readonly totalAmount: number | null;
  readonly currencyId: string | null;
}

export interface InsuranceInput {
  readonly insurerPartyId: string | null;
  readonly policyNumber: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly coverageAmount: number | null;
  readonly currencyId: string | null;
  readonly status: string;
  readonly notes: string | null;
}

export interface InspectionInput {
  readonly inspectionType: string;
  readonly inspectorUserId: string | null;
  readonly performedAt: string;
  readonly result: string;
  readonly status: string;
  readonly checklist: Record<string, unknown>;
  readonly notes: string | null;
  readonly nextDueAt: string | null;
}

export interface AssetLocationInput {
  readonly cityId: string | null;
  readonly observedAt: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly source: string;
  readonly accuracyM: number | null;
  readonly providerReference: string | null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireUuid(value: string, field = 'id'): string {
  if (!uuidPattern.test(value)) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return value;
}

export function parseAvailability(input: unknown, asset = false): AvailabilityInput {
  const body = object(input);
  const statuses = asset
    ? ['available', 'assigned', 'maintenance', 'unavailable', 'offline']
    : ['available', 'assigned', 'unavailable', 'offline'];
  const result: AvailabilityInput = {
    status: enumeration(body.status ?? 'offline', 'status', statuses),
    availableFrom: optionalDateTime(body.availableFrom, 'availableFrom'),
    availableUntil: optionalDateTime(body.availableUntil, 'availableUntil'),
    currentCityId: optionalUuid(body.currentCityId, 'currentCityId'),
    destinationCityId: asset ? null : optionalUuid(body.destinationCityId, 'destinationCityId'),
    maxDistanceKm: asset ? null : optionalNonNegativeNumber(body.maxDistanceKm, 'maxDistanceKm'),
    notes: optionalString(body.notes, 'notes', 500),
  };
  chronological(result.availableFrom, result.availableUntil, 'availability');
  return result;
}

export function parseDocumentRegister(input: unknown): DocumentRegisterInput {
  const body = object(input);
  const issuedOn = optionalDate(body.issuedOn, 'issuedOn');
  const expiresOn = optionalDate(body.expiresOn, 'expiresOn');
  chronological(issuedOn, expiresOn, 'document validity');
  return {
    documentTypeId: requireUuid(
      requiredString(body.documentTypeId, 'documentTypeId', 80),
      'documentTypeId',
    ),
    documentNumber: optionalString(body.documentNumber, 'documentNumber', 120),
    issuer: optionalString(body.issuer, 'issuer', 180),
    issuedOn,
    expiresOn,
    status: enumeration(body.status ?? 'pending', 'status', [
      'pending',
      'valid',
      'expired',
      'blocked',
      'inactive',
    ]),
    validationStatus: enumeration(body.validationStatus ?? 'pending', 'validationStatus', [
      'pending',
      'validated',
      'rejected',
      'not_required',
    ]),
    notes: optionalString(body.notes, 'notes', 1000),
  };
}

export function parseQualification(input: unknown): QualificationInput {
  const body = object(input);
  const issuedOn = optionalDate(body.issuedOn, 'issuedOn');
  const expiresOn = optionalDate(body.expiresOn, 'expiresOn');
  chronological(issuedOn, expiresOn, 'qualification validity');
  return {
    qualificationType: enumeration(body.qualificationType, 'qualificationType', [
      'license',
      'endorsement',
      'certification',
      'authorization',
      'other',
    ]),
    code: requiredString(body.code, 'code', 80),
    name: requiredString(body.name, 'name', 180),
    certificateNumber: optionalString(body.certificateNumber, 'certificateNumber', 120),
    issuer: optionalString(body.issuer, 'issuer', 180),
    issuedOn,
    expiresOn,
    status: enumeration(body.status ?? 'valid', 'status', [
      'pending',
      'valid',
      'expired',
      'blocked',
      'inactive',
    ]),
    notes: optionalString(body.notes, 'notes', 1000),
  };
}

export function parseCourse(input: unknown): CourseInput {
  const body = object(input);
  const completedOn = requiredDate(body.completedOn, 'completedOn');
  const expiresOn = optionalDate(body.expiresOn, 'expiresOn');
  chronological(completedOn, expiresOn, 'course validity');
  return {
    courseCode: requiredString(body.courseCode, 'courseCode', 80),
    courseName: requiredString(body.courseName, 'courseName', 200),
    provider: optionalString(body.provider, 'provider', 180),
    certificateNumber: optionalString(body.certificateNumber, 'certificateNumber', 120),
    completedOn,
    expiresOn,
    workloadHours: optionalPositiveNumber(body.workloadHours, 'workloadHours'),
    status: enumeration(body.status ?? 'valid', 'status', [
      'pending',
      'valid',
      'expired',
      'blocked',
      'inactive',
    ]),
    notes: optionalString(body.notes, 'notes', 1000),
  };
}

export function parseUnavailability(input: unknown): UnavailabilityInput {
  const body = object(input);
  const startsAt = requiredDateTime(body.startsAt, 'startsAt');
  const endsAt = requiredDateTime(body.endsAt, 'endsAt');
  chronological(startsAt, endsAt, 'unavailability');
  if (Date.parse(endsAt) === Date.parse(startsAt)) {
    throw new BadRequestException('endsAt must be after startsAt');
  }
  return {
    reasonCode: requiredString(body.reasonCode, 'reasonCode', 64),
    reason: requiredString(body.reason, 'reason', 500),
    startsAt,
    endsAt,
    status: enumeration(body.status ?? 'scheduled', 'status', [
      'scheduled',
      'active',
      'completed',
      'cancelled',
    ]),
  };
}

export function parseEmergencyContact(input: unknown): EmergencyContactInput {
  const body = object(input);
  const phone = requiredString(body.phone, 'phone', 32);
  if (phone.length < 8) throw new BadRequestException('phone must contain at least 8 characters');
  return {
    name: requiredString(body.name, 'name', 180),
    relationship: optionalString(body.relationship, 'relationship', 80),
    phone,
    isPrimary: booleanValue(body.isPrimary ?? false, 'isPrimary'),
    isActive: booleanValue(body.isActive ?? true, 'isActive'),
  };
}

export function parseBlock(input: unknown, asset = false): BlockInput {
  const body = object(input);
  const startsAt = optionalDateTime(body.startsAt, 'startsAt');
  const endsAt = optionalDateTime(body.endsAt, 'endsAt');
  chronological(startsAt, endsAt, 'block');
  return {
    reasonCode: requiredString(body.reasonCode, 'reasonCode', 64),
    reason: requiredString(body.reason, 'reason', 1000),
    severity: enumeration(
      body.severity ?? 'operational',
      'severity',
      asset
        ? ['operational', 'compliance', 'legal', 'safety', 'maintenance']
        : ['operational', 'compliance', 'legal', 'safety'],
    ),
    startsAt,
    endsAt,
  };
}

export function parseReleaseBlock(input: unknown): ReleaseBlockInput {
  const body = object(input);
  return { releaseReason: requiredString(body.releaseReason, 'releaseReason', 1000) };
}

export function parseRating(input: unknown): RatingInput {
  const body = object(input);
  const score = numberValue(body.score, 'score');
  if (score < 0 || score > 5) throw new BadRequestException('score must be between 0 and 5');
  return {
    transportRequestId: optionalUuid(body.transportRequestId, 'transportRequestId'),
    dimension: requiredString(body.dimension, 'dimension', 64),
    score,
    note: optionalString(body.note, 'note', 1000),
  };
}

export function parseAssetCapabilities(input: unknown): AssetCapabilitiesInput {
  const body = object(input);
  const minTemperatureC = optionalNumber(body.minTemperatureC, 'minTemperatureC');
  const maxTemperatureC = optionalNumber(body.maxTemperatureC, 'maxTemperatureC');
  if (minTemperatureC !== null && maxTemperatureC !== null && minTemperatureC > maxTemperatureC) {
    throw new BadRequestException('minTemperatureC must be <= maxTemperatureC');
  }
  const maxPallets = optionalInteger(body.maxPallets, 'maxPallets');
  if (maxPallets !== null && maxPallets <= 0)
    throw new BadRequestException('maxPallets must be greater than 0');
  return {
    refrigerated: booleanValue(body.refrigerated ?? false, 'refrigerated'),
    sealed: booleanValue(body.sealed ?? false, 'sealed'),
    sideLoading: booleanValue(body.sideLoading ?? false, 'sideLoading'),
    rearLoading: booleanValue(body.rearLoading ?? false, 'rearLoading'),
    dangerousGoods: booleanValue(body.dangerousGoods ?? false, 'dangerousGoods'),
    foodGrade: booleanValue(body.foodGrade ?? false, 'foodGrade'),
    trackingCapable: booleanValue(body.trackingCapable ?? false, 'trackingCapable'),
    maxPallets,
    minTemperatureC,
    maxTemperatureC,
  };
}

export function parseMaintenancePlan(input: unknown): MaintenancePlanInput {
  const body = object(input);
  const intervalDays = optionalInteger(body.intervalDays, 'intervalDays');
  const intervalOdometerKm = optionalPositiveNumber(body.intervalOdometerKm, 'intervalOdometerKm');
  if ((intervalDays === null || intervalDays <= 0) && intervalOdometerKm === null) {
    throw new BadRequestException(
      'maintenance plan requires a positive intervalDays or intervalOdometerKm',
    );
  }
  return {
    name: requiredString(body.name, 'name', 180),
    maintenanceType: requiredString(body.maintenanceType, 'maintenanceType', 64),
    intervalDays,
    intervalOdometerKm,
    nextDueOn: optionalDate(body.nextDueOn, 'nextDueOn'),
    nextDueOdometerKm: optionalNonNegativeNumber(body.nextDueOdometerKm, 'nextDueOdometerKm'),
    isActive: booleanValue(body.isActive ?? true, 'isActive'),
    notes: optionalString(body.notes, 'notes', 1000),
  };
}

export function parseMaintenance(input: unknown): MaintenanceInput {
  const body = object(input);
  const plannedAt = optionalDateTime(body.plannedAt, 'plannedAt');
  const startedAt = optionalDateTime(body.startedAt, 'startedAt');
  const completedAt = optionalDateTime(body.completedAt, 'completedAt');
  chronological(plannedAt, startedAt, 'maintenance planned/start');
  chronological(startedAt, completedAt, 'maintenance start/completion');
  const totalCost = optionalNonNegativeNumber(body.totalCost, 'totalCost');
  const currencyId = optionalUuid(body.currencyId, 'currencyId');
  if (totalCost !== null && currencyId === null)
    throw new BadRequestException('currencyId is required when totalCost is provided');
  return {
    maintenancePlanId: optionalUuid(body.maintenancePlanId, 'maintenancePlanId'),
    providerPartyId: optionalUuid(body.providerPartyId, 'providerPartyId'),
    maintenanceType: requiredString(body.maintenanceType, 'maintenanceType', 64),
    status: enumeration(body.status ?? 'planned', 'status', [
      'planned',
      'in_progress',
      'completed',
      'cancelled',
    ]),
    plannedAt,
    startedAt,
    completedAt,
    odometerKm: optionalNonNegativeNumber(body.odometerKm, 'odometerKm'),
    totalCost,
    currencyId,
    notes: optionalString(body.notes, 'notes', 1500),
  };
}

export function parseMaintenanceItem(input: unknown): MaintenanceItemInput {
  const body = object(input);
  const quantity = body.quantity === undefined ? 1 : numberValue(body.quantity, 'quantity');
  if (quantity <= 0) throw new BadRequestException('quantity must be greater than 0');
  const unitAmount = optionalNonNegativeNumber(body.unitAmount, 'unitAmount');
  const totalAmount = optionalNonNegativeNumber(body.totalAmount, 'totalAmount');
  const currencyId = optionalUuid(body.currencyId, 'currencyId');
  if ((unitAmount !== null || totalAmount !== null) && currencyId === null) {
    throw new BadRequestException('currencyId is required when monetary amounts are provided');
  }
  return {
    itemType: requiredString(body.itemType, 'itemType', 64),
    description: requiredString(body.description, 'description', 500),
    quantity,
    unitAmount,
    totalAmount,
    currencyId,
  };
}

export function parseInsurance(input: unknown): InsuranceInput {
  const body = object(input);
  const startsOn = requiredDate(body.startsOn, 'startsOn');
  const endsOn = requiredDate(body.endsOn, 'endsOn');
  chronological(startsOn, endsOn, 'insurance validity');
  const coverageAmount = optionalNonNegativeNumber(body.coverageAmount, 'coverageAmount');
  const currencyId = optionalUuid(body.currencyId, 'currencyId');
  if (coverageAmount !== null && currencyId === null)
    throw new BadRequestException('currencyId is required when coverageAmount is provided');
  return {
    insurerPartyId: optionalUuid(body.insurerPartyId, 'insurerPartyId'),
    policyNumber: requiredString(body.policyNumber, 'policyNumber', 120),
    startsOn,
    endsOn,
    coverageAmount,
    currencyId,
    status: enumeration(body.status ?? 'active', 'status', [
      'pending',
      'active',
      'expired',
      'cancelled',
    ]),
    notes: optionalString(body.notes, 'notes', 1000),
  };
}

export function parseInspection(input: unknown): InspectionInput {
  const body = object(input);
  const performedAt = requiredDateTime(body.performedAt, 'performedAt');
  const nextDueAt = optionalDateTime(body.nextDueAt, 'nextDueAt');
  chronological(performedAt, nextDueAt, 'inspection schedule');
  return {
    inspectionType: requiredString(body.inspectionType, 'inspectionType', 64),
    inspectorUserId: optionalUuid(body.inspectorUserId, 'inspectorUserId'),
    performedAt,
    result: enumeration(body.result, 'result', [
      'passed',
      'failed',
      'conditional',
      'not_applicable',
    ]),
    status: enumeration(body.status ?? 'finalized', 'status', ['draft', 'finalized', 'cancelled']),
    checklist: jsonObject(body.checklist ?? {}, 'checklist'),
    notes: optionalString(body.notes, 'notes', 1500),
    nextDueAt,
  };
}

export function parseAssetLocation(input: unknown): AssetLocationInput {
  const body = object(input);
  const latitude = numberValue(body.latitude, 'latitude');
  const longitude = numberValue(body.longitude, 'longitude');
  if (latitude < -90 || latitude > 90)
    throw new BadRequestException('latitude must be between -90 and 90');
  if (longitude < -180 || longitude > 180)
    throw new BadRequestException('longitude must be between -180 and 180');
  return {
    cityId: optionalUuid(body.cityId, 'cityId'),
    observedAt: requiredDateTime(body.observedAt, 'observedAt'),
    latitude,
    longitude,
    source: enumeration(body.source, 'source', [
      'gps',
      'mobile',
      'manual',
      'integration',
      'telematics',
    ]),
    accuracyM: optionalNonNegativeNumber(body.accuracyM, 'accuracyM'),
    providerReference: optionalString(body.providerReference, 'providerReference', 160),
  };
}

function object(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BadRequestException('request body must be an object');
  }
  return input as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) {
    throw new BadRequestException(`${field} must be a non-empty string up to ${max} characters`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredString(value, field, max);
}

function enumeration(value: unknown, field: string, allowed: readonly string[]): string {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new BadRequestException(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new BadRequestException(`${field} must be boolean`);
  return value;
}

function numberValue(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException(`${field} must be a finite number`);
  }
  return value;
}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  return numberValue(value, field);
}

function optionalNonNegativeNumber(value: unknown, field: string): number | null {
  const result = optionalNumber(value, field);
  if (result !== null && result < 0) throw new BadRequestException(`${field} must be >= 0`);
  return result;
}

function optionalPositiveNumber(value: unknown, field: string): number | null {
  const result = optionalNumber(value, field);
  if (result !== null && result <= 0) throw new BadRequestException(`${field} must be > 0`);
  return result;
}

function optionalInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value))
    throw new BadRequestException(`${field} must be an integer`);
  return value;
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a UUID`);
  return requireUuid(value, field);
}

function requiredDate(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  ) {
    throw new BadRequestException(`${field} must be an ISO date (YYYY-MM-DD)`);
  }
  return value;
}

function optionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredDate(value, field);
}

function requiredDateTime(value: unknown, field: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new BadRequestException(`${field} must be a valid ISO datetime`);
  }
  return new Date(value).toISOString();
}

function optionalDateTime(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredDateTime(value, field);
}

function chronological(start: string | null, end: string | null, label: string): void {
  if (start !== null && end !== null && Date.parse(end) < Date.parse(start)) {
    throw new BadRequestException(`${label} end must be on or after start`);
  }
}

function jsonObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException(`${field} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}
