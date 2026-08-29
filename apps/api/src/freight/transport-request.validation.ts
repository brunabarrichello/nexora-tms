import { BadRequestException } from '@nestjs/common';

export type TransportRequestStatus =
  'draft' | 'ready_for_quote' | 'in_negotiation' | 'contracted' | 'cancelled';

export interface CreateTransportRequestInput {
  readonly customerPartyId: string;
  readonly shipperPartyId: string;
  readonly consigneePartyId: string;
  readonly originAddressId: string;
  readonly destinationAddressId: string;
  readonly plannedPickupAt: Date;
  readonly plannedDeliveryAt: Date;
  readonly cargoDescription: string;
  readonly status: 'draft' | 'ready_for_quote';
}

export interface UpdateTransportRequestInput {
  customerPartyId?: string;
  shipperPartyId?: string;
  consigneePartyId?: string;
  originAddressId?: string;
  destinationAddressId?: string;
  plannedPickupAt?: Date;
  plannedDeliveryAt?: Date;
  cargoDescription?: string;
  status?: 'draft' | 'ready_for_quote';
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
  }
  return value as Record<string, unknown>;
}

export function requireUuid(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return value.toLowerCase();
}

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new BadRequestException(`${field} must be an ISO date-time`);
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid ISO date-time`);
  }
  return date;
}

function parseCargoDescription(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException('cargoDescription must be a string');
  }
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 1000) {
    throw new BadRequestException('cargoDescription must contain between 3 and 1000 characters');
  }
  return normalized;
}

function parseEditableStatus(value: unknown): 'draft' | 'ready_for_quote' {
  if (value !== 'draft' && value !== 'ready_for_quote') {
    throw new BadRequestException('status must be draft or ready_for_quote');
  }
  return value;
}

function assertWindow(pickup: Date, delivery: Date): void {
  if (delivery.getTime() < pickup.getTime()) {
    throw new BadRequestException(
      'plannedDeliveryAt must be greater than or equal to plannedPickupAt',
    );
  }
}

export function parseCreateTransportRequest(input: unknown): CreateTransportRequestInput {
  const body = requireObject(input);
  const plannedPickupAt = parseDate(body.plannedPickupAt, 'plannedPickupAt');
  const plannedDeliveryAt = parseDate(body.plannedDeliveryAt, 'plannedDeliveryAt');
  const originAddressId = requireUuid(body.originAddressId, 'originAddressId');
  const destinationAddressId = requireUuid(body.destinationAddressId, 'destinationAddressId');

  assertWindow(plannedPickupAt, plannedDeliveryAt);
  if (originAddressId === destinationAddressId) {
    throw new BadRequestException('originAddressId and destinationAddressId must be different');
  }

  return {
    customerPartyId: requireUuid(body.customerPartyId, 'customerPartyId'),
    shipperPartyId: requireUuid(body.shipperPartyId, 'shipperPartyId'),
    consigneePartyId: requireUuid(body.consigneePartyId, 'consigneePartyId'),
    originAddressId,
    destinationAddressId,
    plannedPickupAt,
    plannedDeliveryAt,
    cargoDescription: parseCargoDescription(body.cargoDescription),
    status: body.status === undefined ? 'draft' : parseEditableStatus(body.status),
  };
}

export function parseUpdateTransportRequest(input: unknown): UpdateTransportRequestInput {
  const body = requireObject(input);
  const update: UpdateTransportRequestInput = {};

  if (body.customerPartyId !== undefined) {
    update.customerPartyId = requireUuid(body.customerPartyId, 'customerPartyId');
  }
  if (body.shipperPartyId !== undefined) {
    update.shipperPartyId = requireUuid(body.shipperPartyId, 'shipperPartyId');
  }
  if (body.consigneePartyId !== undefined) {
    update.consigneePartyId = requireUuid(body.consigneePartyId, 'consigneePartyId');
  }
  if (body.originAddressId !== undefined) {
    update.originAddressId = requireUuid(body.originAddressId, 'originAddressId');
  }
  if (body.destinationAddressId !== undefined) {
    update.destinationAddressId = requireUuid(body.destinationAddressId, 'destinationAddressId');
  }
  if (body.plannedPickupAt !== undefined) {
    update.plannedPickupAt = parseDate(body.plannedPickupAt, 'plannedPickupAt');
  }
  if (body.plannedDeliveryAt !== undefined) {
    update.plannedDeliveryAt = parseDate(body.plannedDeliveryAt, 'plannedDeliveryAt');
  }
  if (body.cargoDescription !== undefined) {
    update.cargoDescription = parseCargoDescription(body.cargoDescription);
  }
  if (body.status !== undefined) {
    update.status = parseEditableStatus(body.status);
  }

  if (Object.keys(update).length === 0) {
    throw new BadRequestException('At least one field must be supplied for update');
  }

  if (
    update.originAddressId !== undefined &&
    update.destinationAddressId !== undefined &&
    update.originAddressId === update.destinationAddressId
  ) {
    throw new BadRequestException('originAddressId and destinationAddressId must be different');
  }
  if (update.plannedPickupAt && update.plannedDeliveryAt) {
    assertWindow(update.plannedPickupAt, update.plannedDeliveryAt);
  }

  return update;
}

export function assertPlannedWindow(pickup: Date, delivery: Date): void {
  assertWindow(pickup, delivery);
}
