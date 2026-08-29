import { BadRequestException } from '@nestjs/common';

export type CommercialTermsStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

export interface CommercialTermsInput {
  readonly currencyCode: string;
  readonly customerPrice: number | null;
  readonly targetCarrierFreight: number;
  readonly tollAmount: number;
  readonly additionalAmount: number;
  readonly paymentTerms: string;
  readonly commercialNotes: string | null;
}

export interface CommercialStatusInput {
  readonly status: Exclude<CommercialTermsStatus, 'draft'>;
  readonly note: string | null;
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: string, maxLength: number): string {
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
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a string`);
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} must contain at most ${maxLength} characters`);
  }
  return normalized || null;
}

function money(value: unknown, field: string, minimum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new BadRequestException(`${field} must be a number greater than or equal to ${minimum}`);
  }
  return Math.round(value * 100) / 100;
}

export function parseCommercialTerms(input: unknown): CommercialTermsInput {
  const body = objectBody(input);
  const currencyCode =
    body.currencyCode === undefined
      ? 'BRL'
      : requiredText(body.currencyCode, 'currencyCode', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw new BadRequestException('currencyCode must contain exactly three letters');
  }

  const customerPrice =
    body.customerPrice === undefined || body.customerPrice === null
      ? null
      : money(body.customerPrice, 'customerPrice', 0);
  const targetCarrierFreight = money(body.targetCarrierFreight, 'targetCarrierFreight', 0.01);
  const tollAmount = body.tollAmount === undefined ? 0 : money(body.tollAmount, 'tollAmount', 0);
  const additionalAmount =
    body.additionalAmount === undefined ? 0 : money(body.additionalAmount, 'additionalAmount', 0);

  return {
    currencyCode,
    customerPrice,
    targetCarrierFreight,
    tollAmount,
    additionalAmount,
    paymentTerms: requiredText(body.paymentTerms, 'paymentTerms', 300),
    commercialNotes: optionalText(body.commercialNotes, 'commercialNotes', 1000),
  };
}

export function parseCommercialStatus(input: unknown): CommercialStatusInput {
  const body = objectBody(input);
  const status = body.status;
  if (status !== 'pending_approval' && status !== 'approved' && status !== 'rejected') {
    throw new BadRequestException('status must be pending_approval, approved or rejected');
  }
  const note = optionalText(body.note, 'note', 1000);
  if (status === 'rejected' && !note) {
    throw new BadRequestException('note is required when commercial terms are rejected');
  }
  return { status, note };
}
