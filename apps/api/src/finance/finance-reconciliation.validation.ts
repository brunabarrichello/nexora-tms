import { BadRequestException } from '@nestjs/common';

import type {
  FinancialReconciliationDirection,
  FinancialReconciliationMatchMethod,
  FinancialReconciliationTargetType,
} from './finance-reconciliation.types.js';

export interface FinancialReconciliationImportEntryInput {
  readonly externalId: string | null;
  readonly direction: FinancialReconciliationDirection;
  readonly amount: string;
  readonly currencyCode: string;
  readonly occurredAt: string;
  readonly reference: string | null;
  readonly counterpartyName: string | null;
  readonly rawPayload: Record<string, unknown>;
}

export interface CreateFinancialReconciliationImportInput {
  readonly source: string;
  readonly provider: string | null;
  readonly externalBatchId: string | null;
  readonly accountReference: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly entries: readonly FinancialReconciliationImportEntryInput[];
}

export interface ReconcileFinancialEntryInput {
  readonly targetType: FinancialReconciliationTargetType;
  readonly targetId: string;
  readonly matchMethod: FinancialReconciliationMatchMethod;
  readonly proofDocumentId: string | null;
  readonly notes: string | null;
}

export interface ReverseFinancialReconciliationInput {
  readonly reason: string;
}

export interface IgnoreFinancialReconciliationInput {
  readonly reason: string;
}

export function requireReconciliationUuid(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be a UUID`);
  const normalized = value.trim().toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
  ) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return normalized;
}

export function parseCreateFinancialReconciliationImport(
  input: unknown,
): CreateFinancialReconciliationImportInput {
  const body = requireObject(input);
  const entriesValue = body.entries;
  if (!Array.isArray(entriesValue) || entriesValue.length === 0 || entriesValue.length > 500) {
    throw new BadRequestException('entries must contain between 1 and 500 items');
  }

  const periodStart = optionalDate(body.periodStart, 'periodStart');
  const periodEnd = optionalDate(body.periodEnd, 'periodEnd');
  if (periodStart && periodEnd && periodEnd < periodStart) {
    throw new BadRequestException('periodEnd must be on or after periodStart');
  }

  return {
    source: requireText(body.source, 'source', 40),
    provider: optionalText(body.provider, 'provider', 80),
    externalBatchId: optionalText(body.externalBatchId, 'externalBatchId', 160),
    accountReference: optionalText(body.accountReference, 'accountReference', 160),
    periodStart,
    periodEnd,
    entries: entriesValue.map((value, index) => parseImportEntry(value, index)),
  };
}

export function parseReconcileFinancialEntry(input: unknown): ReconcileFinancialEntryInput {
  const body = requireObject(input);
  return {
    targetType: requireTargetType(body.targetType),
    targetId: requireReconciliationUuid(body.targetId, 'targetId'),
    matchMethod: requireMatchMethod(body.matchMethod),
    proofDocumentId:
      body.proofDocumentId === undefined ||
      body.proofDocumentId === null ||
      body.proofDocumentId === ''
        ? null
        : requireReconciliationUuid(body.proofDocumentId, 'proofDocumentId'),
    notes: optionalText(body.notes, 'notes', 1000),
  };
}

export function parseReverseFinancialReconciliation(
  input: unknown,
): ReverseFinancialReconciliationInput {
  const body = requireObject(input);
  const reason = requireText(body.reason, 'reason', 1000);
  if (reason.length < 10) throw new BadRequestException('reason must have at least 10 characters');
  return { reason };
}

export function parseIgnoreFinancialReconciliation(
  input: unknown,
): IgnoreFinancialReconciliationInput {
  const body = requireObject(input);
  const reason = requireText(body.reason, 'reason', 1000);
  if (reason.length < 10) throw new BadRequestException('reason must have at least 10 characters');
  return { reason };
}

function parseImportEntry(value: unknown, index: number): FinancialReconciliationImportEntryInput {
  const body = requireObject(value, `entries[${index}]`);
  return {
    externalId: optionalText(body.externalId, `entries[${index}].externalId`, 160),
    direction: requireDirection(body.direction, index),
    amount: requireMoney(body.amount, `entries[${index}].amount`),
    currencyCode: requireCurrency(body.currencyCode, index),
    occurredAt: requireDateTime(body.occurredAt, `entries[${index}].occurredAt`),
    reference: optionalText(body.reference, `entries[${index}].reference`, 300),
    counterpartyName: optionalText(
      body.counterpartyName,
      `entries[${index}].counterpartyName`,
      200,
    ),
    rawPayload: optionalPayload(body.rawPayload, index),
  };
}

function requireObject(input: unknown, field = 'request body'): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException(`${field} must be an object`);
  }
  return input as Record<string, unknown>;
}

function requireDirection(value: unknown, index: number): FinancialReconciliationDirection {
  if (value !== 'credit' && value !== 'debit') {
    throw new BadRequestException(`entries[${index}].direction must be credit or debit`);
  }
  return value;
}

function requireTargetType(value: unknown): FinancialReconciliationTargetType {
  if (value !== 'customer_receivable' && value !== 'carrier_payment') {
    throw new BadRequestException('targetType must be customer_receivable or carrier_payment');
  }
  return value;
}

function requireMatchMethod(value: unknown): FinancialReconciliationMatchMethod {
  if (value === undefined) return 'manual';
  if (value !== 'suggested' && value !== 'manual') {
    throw new BadRequestException('matchMethod must be suggested or manual');
  }
  return value;
}

function requireMoney(value: unknown, field: string): string {
  const text =
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(text) || Number(text) <= 0) {
    throw new BadRequestException(
      `${field} must be a positive monetary value with up to 2 decimals`,
    );
  }
  return Number(text).toFixed(2);
}

function requireCurrency(value: unknown, index: number): string {
  if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value.trim())) {
    throw new BadRequestException(`entries[${index}].currencyCode must be a 3-letter code`);
  }
  return value.trim().toUpperCase();
}

function requireDateTime(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be an ISO date-time`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new BadRequestException(`${field} must be a valid date-time`);
  return date.toISOString();
}

function optionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new BadRequestException(`${field} must be YYYY-MM-DD`);
  }
  return value.trim();
}

function requireText(value: unknown, field: string, max: number): string {
  const text = optionalText(value, field, max);
  if (!text) throw new BadRequestException(`${field} is required`);
  return text;
}

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be text`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max)
    throw new BadRequestException(`${field} must have at most ${max} characters`);
  return text;
}

function optionalPayload(value: unknown, index: number): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`entries[${index}].rawPayload must be an object`);
  }
  const payload = value as Record<string, unknown>;
  if (JSON.stringify(payload).length > 20_000) {
    throw new BadRequestException(`entries[${index}].rawPayload is too large`);
  }
  return payload;
}
