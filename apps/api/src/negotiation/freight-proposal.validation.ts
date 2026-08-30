import { BadRequestException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';

export type FreightProposalStatus = 'open' | 'accepted' | 'rejected' | 'expired';

export interface FreightProposalTermsInput {
  readonly currencyCode: string;
  readonly freightAmount: number;
  readonly tollAmount: number;
  readonly additionalAmount: number;
  readonly paymentTerms: string;
  readonly commercialNotes: string | null;
  readonly expiresAt: string | null;
}

export interface FreightProposalCreateInput extends FreightProposalTermsInput {
  readonly capacityAssignmentId: string;
}

export interface FreightProposalStatusInput {
  readonly status: Exclude<FreightProposalStatus, 'open'>;
  readonly reason: string | null;
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

function parseTerms(body: Record<string, unknown>): FreightProposalTermsInput {
  const currencyCode =
    body.currencyCode === undefined
      ? 'BRL'
      : requiredText(body.currencyCode, 'currencyCode', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw new BadRequestException('currencyCode must contain exactly three letters');
  }

  let expiresAt: string | null = null;
  if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== '') {
    if (typeof body.expiresAt !== 'string') {
      throw new BadRequestException('expiresAt must be an ISO date-time string');
    }
    const parsed = new Date(body.expiresAt);
    if (Number.isNaN(parsed.valueOf())) {
      throw new BadRequestException('expiresAt must be a valid ISO date-time string');
    }
    if (parsed.valueOf() <= Date.now()) {
      throw new BadRequestException('expiresAt must be in the future');
    }
    expiresAt = parsed.toISOString();
  }

  return {
    currencyCode,
    freightAmount: money(body.freightAmount, 'freightAmount', 0.01),
    tollAmount: body.tollAmount === undefined ? 0 : money(body.tollAmount, 'tollAmount', 0),
    additionalAmount:
      body.additionalAmount === undefined ? 0 : money(body.additionalAmount, 'additionalAmount', 0),
    paymentTerms: requiredText(body.paymentTerms, 'paymentTerms', 300),
    commercialNotes: optionalText(body.commercialNotes, 'commercialNotes', 1000),
    expiresAt,
  };
}

export function parseFreightProposalCreate(input: unknown): FreightProposalCreateInput {
  const body = objectBody(input);
  return {
    capacityAssignmentId: requireUuid(body.capacityAssignmentId, 'capacityAssignmentId'),
    ...parseTerms(body),
  };
}

export function parseFreightCounterproposal(input: unknown): FreightProposalTermsInput {
  return parseTerms(objectBody(input));
}

export function parseFreightProposalStatus(input: unknown): FreightProposalStatusInput {
  const body = objectBody(input);
  const status = body.status;
  if (status !== 'accepted' && status !== 'rejected' && status !== 'expired') {
    throw new BadRequestException('status must be accepted, rejected or expired');
  }
  const reason = optionalText(body.reason, 'reason', 1000);
  if (status === 'rejected' && !reason) {
    throw new BadRequestException('reason is required when a proposal is rejected');
  }
  return { status, reason };
}
