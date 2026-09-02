import { BadRequestException } from '@nestjs/common';

import type { CustomerReceivableTransactionKind } from './finance-receivable.types.js';

export interface CreateCustomerReceivableInput {
  readonly transportRequestId: string;
  readonly invoicedAmount: string;
  readonly dueAt: string;
  readonly fiscalDocumentId: string | null;
  readonly fiscalReference: string | null;
  readonly notes: string | null;
}

export interface UpdateCustomerReceivableInput {
  dueAt?: string;
  fiscalDocumentId?: string | null;
  fiscalReference?: string | null;
  notes?: string | null;
}

export interface CancelCustomerReceivableInput {
  readonly reason: string;
}

export interface CreateCustomerReceivableTransactionInput {
  readonly kind: CustomerReceivableTransactionKind;
  readonly amount: string;
  readonly relatedTransactionId: string | null;
  readonly proofDocumentId: string | null;
  readonly occurredAt: string;
  readonly notes: string | null;
}

export function requireReceivableUuid(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a UUID`);
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return normalized;
}

export function parseCreateCustomerReceivable(input: unknown): CreateCustomerReceivableInput {
  const body = requireObject(input);
  return {
    transportRequestId: requireReceivableUuid(body.transportRequestId, 'transportRequestId'),
    invoicedAmount: requireMoney(body.invoicedAmount, 'invoicedAmount'),
    dueAt: requireDateTime(body.dueAt, 'dueAt'),
    fiscalDocumentId: optionalNullableUuid(body.fiscalDocumentId, 'fiscalDocumentId') ?? null,
    fiscalReference: optionalText(body.fiscalReference, 'fiscalReference', 160) ?? null,
    notes: optionalText(body.notes, 'notes', 1000) ?? null,
  };
}

export function parseUpdateCustomerReceivable(input: unknown): UpdateCustomerReceivableInput {
  const body = requireObject(input);
  const result: UpdateCustomerReceivableInput = {};
  if ('dueAt' in body) result.dueAt = requireDateTime(body.dueAt, 'dueAt');
  if ('fiscalDocumentId' in body) result.fiscalDocumentId = optionalNullableUuid(body.fiscalDocumentId, 'fiscalDocumentId') ?? null;
  if ('fiscalReference' in body) result.fiscalReference = optionalText(body.fiscalReference, 'fiscalReference', 160) ?? null;
  if ('notes' in body) result.notes = optionalText(body.notes, 'notes', 1000) ?? null;
  if (Object.keys(result).length === 0) throw new BadRequestException('at least one receivable field must be provided');
  return result;
}

export function parseCancelCustomerReceivable(input: unknown): CancelCustomerReceivableInput {
  const body = requireObject(input);
  const reason = optionalText(body.reason, 'reason', 1000);
  if (!reason || reason.length < 10) throw new BadRequestException('reason must have at least 10 characters');
  return { reason };
}

export function parseCreateCustomerReceivableTransaction(input: unknown): CreateCustomerReceivableTransactionInput {
  const body = requireObject(input);
  const kind = requireTransactionKind(body.kind);
  const relatedTransactionId = optionalNullableUuid(body.relatedTransactionId, 'relatedTransactionId') ?? null;
  if (kind === 'reversal' && !relatedTransactionId) throw new BadRequestException('reversal requires relatedTransactionId');
  if (kind === 'receipt' && relatedTransactionId) throw new BadRequestException('receipt cannot reference relatedTransactionId');
  return {
    kind,
    amount: requireMoney(body.amount, 'amount'),
    relatedTransactionId,
    proofDocumentId: optionalNullableUuid(body.proofDocumentId, 'proofDocumentId') ?? null,
    occurredAt: body.occurredAt === undefined ? new Date().toISOString() : requireDateTime(body.occurredAt, 'occurredAt'),
    notes: optionalText(body.notes, 'notes', 1000) ?? null,
  };
}

function requireObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('request body must be an object');
  return input as Record<string, unknown>;
}

function requireDateTime(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be an ISO date-time`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} must be a valid date-time`);
  return date.toISOString();
}

function requireTransactionKind(value: unknown): CustomerReceivableTransactionKind {
  if (value !== 'receipt' && value !== 'reversal') throw new BadRequestException('kind must be receipt or reversal');
  return value;
}

function requireMoney(value: unknown, field: string): string {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(text)) throw new BadRequestException(`${field} must be a positive monetary value with up to 2 decimals`);
  if (Number(text) <= 0) throw new BadRequestException(`${field} must be greater than zero`);
  return Number(text).toFixed(2);
}

function optionalNullableUuid(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return requireReceivableUuid(value, field);
}

function optionalText(value: unknown, field: string, max: number): string | null | undefined {
  if (value === undefined || value === null) return value === undefined ? undefined : null;
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be text`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > max) throw new BadRequestException(`${field} must have at most ${max} characters`);
  return normalized;
}
