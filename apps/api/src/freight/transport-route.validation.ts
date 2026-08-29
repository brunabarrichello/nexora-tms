import { BadRequestException } from '@nestjs/common';

import { requireUuid } from './transport-request.validation.js';

export type TransportStopType = 'pickup' | 'delivery' | 'support';

export interface TransportRouteStopInput {
  readonly sequence: number;
  readonly type: TransportStopType;
  readonly partyId: string;
  readonly addressId: string;
  readonly contactId: string | null;
  readonly windowStartAt: Date;
  readonly windowEndAt: Date;
  readonly instructions: string | null;
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
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

function parseType(value: unknown, field: string): TransportStopType {
  if (value !== 'pickup' && value !== 'delivery' && value !== 'support') {
    throw new BadRequestException(`${field} must be pickup, delivery or support`);
  }
  return value;
}

function parseInstructions(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length > 1000) {
    throw new BadRequestException(`${field} must contain at most 1000 characters`);
  }
  return normalized || null;
}

export function parseReplaceTransportRoute(input: unknown): readonly TransportRouteStopInput[] {
  const body = requireObject(input, 'Request body');
  if (!Array.isArray(body.stops)) {
    throw new BadRequestException('stops must be an array');
  }
  if (body.stops.length < 2 || body.stops.length > 50) {
    throw new BadRequestException('stops must contain between 2 and 50 entries');
  }

  const stops = body.stops.map((rawStop, index) => {
    const field = `stops[${index}]`;
    const stop = requireObject(rawStop, field);
    const windowStartAt = parseDate(stop.windowStartAt, `${field}.windowStartAt`);
    const windowEndAt = parseDate(stop.windowEndAt, `${field}.windowEndAt`);
    if (windowEndAt.getTime() < windowStartAt.getTime()) {
      throw new BadRequestException(
        `${field}.windowEndAt must be greater than or equal to windowStartAt`,
      );
    }

    return {
      sequence: index + 1,
      type: parseType(stop.type, `${field}.type`),
      partyId: requireUuid(stop.partyId, `${field}.partyId`),
      addressId: requireUuid(stop.addressId, `${field}.addressId`),
      contactId:
        stop.contactId === undefined || stop.contactId === null
          ? null
          : requireUuid(stop.contactId, `${field}.contactId`),
      windowStartAt,
      windowEndAt,
      instructions: parseInstructions(stop.instructions, `${field}.instructions`),
    } satisfies TransportRouteStopInput;
  });

  if (stops[0]!.type !== 'pickup') {
    throw new BadRequestException('The first route stop must be pickup');
  }
  if (stops[stops.length - 1]!.type !== 'delivery') {
    throw new BadRequestException('The last route stop must be delivery');
  }

  for (let index = 1; index < stops.length; index += 1) {
    if (stops[index]!.windowStartAt.getTime() < stops[index - 1]!.windowStartAt.getTime()) {
      throw new BadRequestException('Route stop windows must follow the itinerary order');
    }
  }

  return stops;
}
