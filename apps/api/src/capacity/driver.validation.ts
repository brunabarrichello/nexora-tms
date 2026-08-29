import { BadRequestException } from '@nestjs/common';

export type DriverRegistrationStatus = 'pending' | 'qualified' | 'blocked' | 'inactive';
export type DriverOperationalStatus = 'active' | 'blocked' | 'inactive';

export interface DriverInput {
  readonly carrierPartyId: string | null;
  readonly fullName: string;
  readonly taxId: string;
  readonly email: string | null;
  readonly phone: string;
  readonly whatsapp: string | null;
  readonly cnhNumber: string;
  readonly cnhCategory: string;
  readonly cnhExpiresOn: string;
  readonly registrationStatus: DriverRegistrationStatus;
  readonly operationalStatus: DriverOperationalStatus;
  readonly statusReason: string | null;
}

export type DriverPatch = Partial<DriverInput>;

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

function digits(value: unknown, field: string, size: number): string {
  const normalized = text(value, field, 32).replace(/\D/g, '');
  if (normalized.length !== size) {
    throw new BadRequestException(`${field} must contain ${size} digits`);
  }
  return normalized;
}

function uuidOrNull(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  const normalized = text(value, field, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return normalized;
}

function emailOrNull(value: unknown): string | null {
  const email = optionalText(value, 'email', 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('email must be valid');
  }
  return email;
}

function dateOnly(value: unknown, field: string): string {
  const normalized = text(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new BadRequestException(`${field} must use YYYY-MM-DD`);
  }
  return normalized;
}

function category(value: unknown): string {
  const normalized = text(value, 'cnhCategory', 4).toUpperCase();
  if (!/^(A|B|C|D|E|AB|AC|AD|AE)$/.test(normalized)) {
    throw new BadRequestException('cnhCategory must be A, B, C, D, E, AB, AC, AD or AE');
  }
  return normalized;
}

function registration(value: unknown): DriverRegistrationStatus {
  if (value === undefined) return 'pending';
  if (value === 'pending' || value === 'qualified' || value === 'blocked' || value === 'inactive') return value;
  throw new BadRequestException('registrationStatus is invalid');
}

function operational(value: unknown): DriverOperationalStatus {
  if (value === undefined) return 'inactive';
  if (value === 'active' || value === 'blocked' || value === 'inactive') return value;
  throw new BadRequestException('operationalStatus is invalid');
}

function validateStatus(
  registrationStatus: DriverRegistrationStatus,
  operationalStatus: DriverOperationalStatus,
  statusReason: string | null,
): void {
  if (operationalStatus === 'active' && registrationStatus !== 'qualified') {
    throw new BadRequestException('operationalStatus active requires registrationStatus qualified');
  }
  if (
    (registrationStatus === 'blocked' || registrationStatus === 'inactive' || operationalStatus === 'blocked') &&
    !statusReason
  ) {
    throw new BadRequestException('statusReason is required for blocked or cadastrally inactive drivers');
  }
}

export function parseCreateDriver(input: unknown): DriverInput {
  const body = objectBody(input);
  const registrationStatus = registration(body.registrationStatus);
  const operationalStatus = operational(body.operationalStatus);
  const statusReason = optionalText(body.statusReason, 'statusReason', 500);
  validateStatus(registrationStatus, operationalStatus, statusReason);

  return {
    carrierPartyId: uuidOrNull(body.carrierPartyId, 'carrierPartyId'),
    fullName: text(body.fullName, 'fullName', 180, 3),
    taxId: digits(body.taxId, 'taxId', 11),
    email: emailOrNull(body.email),
    phone: text(body.phone, 'phone', 32, 8),
    whatsapp: optionalText(body.whatsapp, 'whatsapp', 32),
    cnhNumber: digits(body.cnhNumber, 'cnhNumber', 11),
    cnhCategory: category(body.cnhCategory),
    cnhExpiresOn: dateOnly(body.cnhExpiresOn, 'cnhExpiresOn'),
    registrationStatus,
    operationalStatus,
    statusReason,
  };
}

export function parseUpdateDriver(input: unknown): DriverPatch {
  const body = objectBody(input);
  const patch: DriverPatch = {};
  if ('carrierPartyId' in body) patch.carrierPartyId = uuidOrNull(body.carrierPartyId, 'carrierPartyId');
  if ('fullName' in body) patch.fullName = text(body.fullName, 'fullName', 180, 3);
  if ('taxId' in body) patch.taxId = digits(body.taxId, 'taxId', 11);
  if ('email' in body) patch.email = emailOrNull(body.email);
  if ('phone' in body) patch.phone = text(body.phone, 'phone', 32, 8);
  if ('whatsapp' in body) patch.whatsapp = optionalText(body.whatsapp, 'whatsapp', 32);
  if ('cnhNumber' in body) patch.cnhNumber = digits(body.cnhNumber, 'cnhNumber', 11);
  if ('cnhCategory' in body) patch.cnhCategory = category(body.cnhCategory);
  if ('cnhExpiresOn' in body) patch.cnhExpiresOn = dateOnly(body.cnhExpiresOn, 'cnhExpiresOn');
  if ('registrationStatus' in body) patch.registrationStatus = registration(body.registrationStatus);
  if ('operationalStatus' in body) patch.operationalStatus = operational(body.operationalStatus);
  if ('statusReason' in body) patch.statusReason = optionalText(body.statusReason, 'statusReason', 500);
  if (Object.keys(patch).length === 0) throw new BadRequestException('At least one field must be provided');
  return patch;
}

export function validateDriverStatusCombination(
  registrationStatus: DriverRegistrationStatus,
  operationalStatus: DriverOperationalStatus,
  statusReason: string | null,
): void {
  validateStatus(registrationStatus, operationalStatus, statusReason);
}
