import { BadRequestException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';

export type NegotiationThreadTransition = 'closed' | 'cancelled';
export type NegotiationParticipantKind = 'internal' | 'external';
export type NegotiationParticipantRole =
  | 'operator'
  | 'commercial'
  | 'carrier'
  | 'driver'
  | 'observer';
export type NegotiationUserMessageKind = 'message' | 'note';

export interface NegotiationThreadCreateInput {
  readonly subject: string;
}

export interface NegotiationThreadStatusInput {
  readonly status: NegotiationThreadTransition;
}

export interface NegotiationParticipantCreateInput {
  readonly kind: NegotiationParticipantKind;
  readonly role: NegotiationParticipantRole;
  readonly membershipId: string | null;
  readonly businessPartyId: string | null;
  readonly businessPartyContactId: string | null;
}

export interface NegotiationMessageCreateInput {
  readonly kind: NegotiationUserMessageKind;
  readonly body: string;
  readonly relatedProposalId: string | null;
  readonly replyToMessageId: string | null;
}

const participantKinds = new Set<NegotiationParticipantKind>(['internal', 'external']);
const participantRoles = new Set<NegotiationParticipantRole>([
  'operator',
  'commercial',
  'carrier',
  'driver',
  'observer',
]);
const userMessageKinds = new Set<NegotiationUserMessageKind>(['message', 'note']);

export function parseNegotiationThreadCreate(input: unknown): NegotiationThreadCreateInput {
  const body = requireRecord(input);
  const subject = requireTrimmedString(body.subject, 'subject', 240);
  return { subject };
}

export function parseNegotiationThreadStatus(input: unknown): NegotiationThreadStatusInput {
  const body = requireRecord(input);
  if (body.status !== 'closed' && body.status !== 'cancelled') {
    throw new BadRequestException('status must be closed or cancelled');
  }
  return { status: body.status };
}

export function parseNegotiationParticipantCreate(
  input: unknown,
): NegotiationParticipantCreateInput {
  const body = requireRecord(input);
  const kind = requireEnum(body.kind, 'kind', participantKinds);
  const role = requireEnum(body.role, 'role', participantRoles);
  const membershipId = optionalUuid(body.membershipId, 'membershipId');
  const businessPartyId = optionalUuid(body.businessPartyId, 'businessPartyId');
  const businessPartyContactId = optionalUuid(
    body.businessPartyContactId,
    'businessPartyContactId',
  );

  if (kind === 'internal') {
    if (!membershipId || businessPartyId || businessPartyContactId) {
      throw new BadRequestException(
        'internal participants require membershipId and cannot specify business party identity',
      );
    }
  } else {
    if (membershipId || !businessPartyId) {
      throw new BadRequestException(
        'external participants require businessPartyId and cannot specify membershipId',
      );
    }
  }

  return { kind, role, membershipId, businessPartyId, businessPartyContactId };
}

export function parseNegotiationMessageCreate(input: unknown): NegotiationMessageCreateInput {
  const body = requireRecord(input);
  const kind = body.kind === undefined ? 'message' : requireEnum(body.kind, 'kind', userMessageKinds);
  const messageBody = requireTrimmedString(body.body, 'body', 8000);
  const relatedProposalId = optionalUuid(body.relatedProposalId, 'relatedProposalId');
  const replyToMessageId = optionalUuid(body.replyToMessageId, 'replyToMessageId');

  return {
    kind,
    body: messageBody,
    relatedProposalId,
    replyToMessageId,
  };
}

function requireRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BadRequestException('Request body must be an object');
  }
  return input as Record<string, unknown>;
}

function requireTrimmedString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} is required`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new BadRequestException(`${field} is required`);
  }
  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} must not exceed ${maxLength} characters`);
  }
  return normalized;
}

function requireEnum<T extends string>(value: unknown, field: string, allowed: Set<T>): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return value as T;
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a UUID`);
  }
  return requireUuid(value, field);
}
