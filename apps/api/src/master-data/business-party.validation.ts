import { BadRequestException } from '@nestjs/common';

export type BusinessPartyRole = 'customer' | 'shipper' | 'consignee';
export type BusinessPartyStatus = 'active' | 'inactive';

export interface CreateBusinessPartyInput {
  readonly taxId: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly roles: readonly BusinessPartyRole[];
}

export interface UpdateBusinessPartyInput {
  taxId?: string;
  legalName?: string;
  tradeName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: BusinessPartyStatus;
  roles?: readonly BusinessPartyRole[];
}

const allowedRoles = new Set<BusinessPartyRole>(['customer', 'shipper', 'consignee']);
const allowedStatuses = new Set<BusinessPartyStatus>(['active', 'inactive']);

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
  }

  return value as Record<string, unknown>;
}

function parseRequiredName(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }

  const normalized = value.trim();
  if (normalized.length < 2 || normalized.length > 200) {
    throw new BadRequestException(`${field} must contain between 2 and 200 characters`);
  }

  return normalized;
}

function parseOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string or null`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} must contain at most ${maxLength} characters`);
  }

  return normalized;
}

export function normalizeTaxId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException('taxId must be a string');
  }

  const normalized = value.replace(/\D/g, '');
  if (normalized.length !== 11 && normalized.length !== 14) {
    throw new BadRequestException('taxId must contain 11 or 14 digits');
  }

  if (/^(\d)\1+$/.test(normalized)) {
    throw new BadRequestException('taxId is not valid');
  }

  return normalized;
}

function parseEmail(value: unknown): string | null | undefined {
  const email = parseOptionalText(value, 'email', 254);
  if (email === undefined || email === null) return email;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('email is not valid');
  }

  return email.toLowerCase();
}

function parsePhone(value: unknown): string | null | undefined {
  const phone = parseOptionalText(value, 'phone', 32);
  if (phone === undefined || phone === null) return phone;

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw new BadRequestException('phone must contain between 8 and 15 digits');
  }

  return phone;
}

function parseRoles(value: unknown, required: boolean): readonly BusinessPartyRole[] | undefined {
  if (value === undefined && !required) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException('roles must contain at least one business party role');
  }

  const roles = [...new Set(value)].map((role) => {
    if (typeof role !== 'string' || !allowedRoles.has(role as BusinessPartyRole)) {
      throw new BadRequestException('roles may contain only customer, shipper or consignee');
    }
    return role as BusinessPartyRole;
  });

  return roles.sort();
}

export function parseCreateBusinessParty(input: unknown): CreateBusinessPartyInput {
  const body = requireObject(input);

  return {
    taxId: normalizeTaxId(body.taxId),
    legalName: parseRequiredName(body.legalName, 'legalName'),
    tradeName: parseOptionalText(body.tradeName, 'tradeName', 200) ?? null,
    email: parseEmail(body.email) ?? null,
    phone: parsePhone(body.phone) ?? null,
    roles: parseRoles(body.roles, true)!,
  };
}

export function parseUpdateBusinessParty(input: unknown): UpdateBusinessPartyInput {
  const body = requireObject(input);
  const update: UpdateBusinessPartyInput = {};

  if (body.taxId !== undefined) update.taxId = normalizeTaxId(body.taxId);
  if (body.legalName !== undefined) {
    update.legalName = parseRequiredName(body.legalName, 'legalName');
  }
  if (body.tradeName !== undefined) {
    update.tradeName = parseOptionalText(body.tradeName, 'tradeName', 200) ?? null;
  }
  if (body.email !== undefined) update.email = parseEmail(body.email) ?? null;
  if (body.phone !== undefined) update.phone = parsePhone(body.phone) ?? null;
  if (body.roles !== undefined) update.roles = parseRoles(body.roles, false);

  if (body.status !== undefined) {
    if (
      typeof body.status !== 'string' ||
      !allowedStatuses.has(body.status as BusinessPartyStatus)
    ) {
      throw new BadRequestException('status must be active or inactive');
    }
    update.status = body.status as BusinessPartyStatus;
  }

  if (Object.keys(update).length === 0) {
    throw new BadRequestException('At least one field must be supplied for update');
  }

  return update;
}

export function requireUuid(value: string, field = 'id'): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }

  return value;
}
