import { BadRequestException } from '@nestjs/common';

import { requireUuid } from './business-party.validation.js';

export type BusinessPartyAddressType = 'billing' | 'pickup' | 'delivery' | 'operational' | 'other';
export type BusinessPartyContactType =
  | 'commercial'
  | 'logistics'
  | 'billing'
  | 'pickup'
  | 'delivery'
  | 'operational'
  | 'other';

export interface CreateBusinessPartyAddressInput {
  readonly type: BusinessPartyAddressType;
  readonly label: string;
  readonly postalCode: string | null;
  readonly street: string;
  readonly number: string | null;
  readonly complement: string | null;
  readonly district: string | null;
  readonly city: string;
  readonly state: string;
  readonly countryCode: string;
  readonly operationalReference: string | null;
}

export interface UpdateBusinessPartyAddressInput {
  type?: BusinessPartyAddressType;
  label?: string;
  postalCode?: string | null;
  street?: string;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string;
  state?: string;
  countryCode?: string;
  operationalReference?: string | null;
  isActive?: boolean;
}

export interface CreateBusinessPartyContactInput {
  readonly addressId: string | null;
  readonly type: BusinessPartyContactType;
  readonly name: string;
  readonly title: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly whatsapp: string | null;
  readonly operationalReference: string | null;
}

export interface UpdateBusinessPartyContactInput {
  addressId?: string | null;
  type?: BusinessPartyContactType;
  name?: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  operationalReference?: string | null;
  isActive?: boolean;
}

const allowedAddressTypes = new Set<BusinessPartyAddressType>([
  'billing',
  'pickup',
  'delivery',
  'operational',
  'other',
]);
const allowedContactTypes = new Set<BusinessPartyContactType>([
  'commercial',
  'logistics',
  'billing',
  'pickup',
  'delivery',
  'operational',
  'other',
]);

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
  }
  return value as Record<string, unknown>;
}

function parseRequiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new BadRequestException(`${field} must contain between 1 and ${maxLength} characters`);
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

function parseAddressType(value: unknown): BusinessPartyAddressType {
  if (typeof value !== 'string' || !allowedAddressTypes.has(value as BusinessPartyAddressType)) {
    throw new BadRequestException('type must be billing, pickup, delivery, operational or other');
  }
  return value as BusinessPartyAddressType;
}

function parseContactType(value: unknown): BusinessPartyContactType {
  if (typeof value !== 'string' || !allowedContactTypes.has(value as BusinessPartyContactType)) {
    throw new BadRequestException(
      'type must be commercial, logistics, billing, pickup, delivery, operational or other',
    );
  }
  return value as BusinessPartyContactType;
}

function parseState(value: unknown): string {
  const state = parseRequiredText(value, 'state', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) {
    throw new BadRequestException('state must contain a two-letter UF code');
  }
  return state;
}

function parseCountryCode(value: unknown): string {
  const code = parseRequiredText(value, 'countryCode', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    throw new BadRequestException('countryCode must contain two letters');
  }
  return code;
}

function parseEmail(value: unknown): string | null | undefined {
  const email = parseOptionalText(value, 'email', 254);
  if (email === undefined || email === null) return email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('email is not valid');
  }
  return email.toLowerCase();
}

function parsePhone(value: unknown, field: 'phone' | 'whatsapp'): string | null | undefined {
  const phone = parseOptionalText(value, field, 32);
  if (phone === undefined || phone === null) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw new BadRequestException(`${field} must contain between 8 and 15 digits`);
  }
  return phone;
}

function parseOptionalAddressId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new BadRequestException('addressId must be a UUID or null');
  }
  return requireUuid(value, 'addressId');
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${field} must be a boolean`);
  }
  return value;
}

export function validateContactChannels(
  email: string | null,
  phone: string | null,
  whatsapp: string | null,
): void {
  if (!email && !phone && !whatsapp) {
    throw new BadRequestException('A contact requires email, phone or whatsapp');
  }
}

export function parseCreateBusinessPartyAddress(input: unknown): CreateBusinessPartyAddressInput {
  const body = requireObject(input);
  return {
    type: parseAddressType(body.type),
    label: parseRequiredText(body.label, 'label', 160),
    postalCode: parseOptionalText(body.postalCode, 'postalCode', 16) ?? null,
    street: parseRequiredText(body.street, 'street', 200),
    number: parseOptionalText(body.number, 'number', 40) ?? null,
    complement: parseOptionalText(body.complement, 'complement', 160) ?? null,
    district: parseOptionalText(body.district, 'district', 120) ?? null,
    city: parseRequiredText(body.city, 'city', 120),
    state: parseState(body.state),
    countryCode: body.countryCode === undefined ? 'BR' : parseCountryCode(body.countryCode),
    operationalReference:
      parseOptionalText(body.operationalReference, 'operationalReference', 500) ?? null,
  };
}

export function parseUpdateBusinessPartyAddress(input: unknown): UpdateBusinessPartyAddressInput {
  const body = requireObject(input);
  const update: UpdateBusinessPartyAddressInput = {};

  if (body.type !== undefined) update.type = parseAddressType(body.type);
  if (body.label !== undefined) update.label = parseRequiredText(body.label, 'label', 160);
  if (body.postalCode !== undefined) {
    update.postalCode = parseOptionalText(body.postalCode, 'postalCode', 16) ?? null;
  }
  if (body.street !== undefined) update.street = parseRequiredText(body.street, 'street', 200);
  if (body.number !== undefined) update.number = parseOptionalText(body.number, 'number', 40) ?? null;
  if (body.complement !== undefined) {
    update.complement = parseOptionalText(body.complement, 'complement', 160) ?? null;
  }
  if (body.district !== undefined) {
    update.district = parseOptionalText(body.district, 'district', 120) ?? null;
  }
  if (body.city !== undefined) update.city = parseRequiredText(body.city, 'city', 120);
  if (body.state !== undefined) update.state = parseState(body.state);
  if (body.countryCode !== undefined) update.countryCode = parseCountryCode(body.countryCode);
  if (body.operationalReference !== undefined) {
    update.operationalReference =
      parseOptionalText(body.operationalReference, 'operationalReference', 500) ?? null;
  }
  if (body.isActive !== undefined) update.isActive = parseBoolean(body.isActive, 'isActive');

  if (Object.keys(update).length === 0) {
    throw new BadRequestException('At least one field must be supplied for update');
  }
  return update;
}

export function parseCreateBusinessPartyContact(input: unknown): CreateBusinessPartyContactInput {
  const body = requireObject(input);
  const email = parseEmail(body.email) ?? null;
  const phone = parsePhone(body.phone, 'phone') ?? null;
  const whatsapp = parsePhone(body.whatsapp, 'whatsapp') ?? null;
  validateContactChannels(email, phone, whatsapp);

  return {
    addressId: parseOptionalAddressId(body.addressId) ?? null,
    type: parseContactType(body.type),
    name: parseRequiredText(body.name, 'name', 160),
    title: parseOptionalText(body.title, 'title', 120) ?? null,
    email,
    phone,
    whatsapp,
    operationalReference:
      parseOptionalText(body.operationalReference, 'operationalReference', 500) ?? null,
  };
}

export function parseUpdateBusinessPartyContact(input: unknown): UpdateBusinessPartyContactInput {
  const body = requireObject(input);
  const update: UpdateBusinessPartyContactInput = {};

  if (body.addressId !== undefined) update.addressId = parseOptionalAddressId(body.addressId) ?? null;
  if (body.type !== undefined) update.type = parseContactType(body.type);
  if (body.name !== undefined) update.name = parseRequiredText(body.name, 'name', 160);
  if (body.title !== undefined) update.title = parseOptionalText(body.title, 'title', 120) ?? null;
  if (body.email !== undefined) update.email = parseEmail(body.email) ?? null;
  if (body.phone !== undefined) update.phone = parsePhone(body.phone, 'phone') ?? null;
  if (body.whatsapp !== undefined) update.whatsapp = parsePhone(body.whatsapp, 'whatsapp') ?? null;
  if (body.operationalReference !== undefined) {
    update.operationalReference =
      parseOptionalText(body.operationalReference, 'operationalReference', 500) ?? null;
  }
  if (body.isActive !== undefined) update.isActive = parseBoolean(body.isActive, 'isActive');

  if (Object.keys(update).length === 0) {
    throw new BadRequestException('At least one field must be supplied for update');
  }
  return update;
}
