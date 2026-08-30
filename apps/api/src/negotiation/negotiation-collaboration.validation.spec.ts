import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  parseNegotiationMessageCreate,
  parseNegotiationParticipantCreate,
  parseNegotiationThreadCreate,
  parseNegotiationThreadStatus,
} from './negotiation-collaboration.validation.js';

const membershipId = '11111111-1111-4111-8111-111111111111';
const partyId = '22222222-2222-4222-8222-222222222222';
const contactId = '33333333-3333-4333-8333-333333333333';
const proposalId = '44444444-4444-4444-8444-444444444444';
const messageId = '55555555-5555-4555-8555-555555555555';

test('parses a trimmed negotiation thread subject', () => {
  assert.deepEqual(parseNegotiationThreadCreate({ subject: '  Cotação SP → PR  ' }), {
    subject: 'Cotação SP → PR',
  });
});

test('accepts only terminal thread transitions', () => {
  assert.deepEqual(parseNegotiationThreadStatus({ status: 'closed' }), { status: 'closed' });
  assert.throws(() => parseNegotiationThreadStatus({ status: 'open' }), BadRequestException);
});

test('parses an internal participant exclusively through membership', () => {
  assert.deepEqual(
    parseNegotiationParticipantCreate({
      kind: 'internal',
      role: 'commercial',
      membershipId,
    }),
    {
      kind: 'internal',
      role: 'commercial',
      membershipId,
      businessPartyId: null,
      businessPartyContactId: null,
    },
  );
});

test('rejects mixed internal and external participant identities', () => {
  assert.throws(
    () =>
      parseNegotiationParticipantCreate({
        kind: 'internal',
        role: 'operator',
        membershipId,
        businessPartyId: partyId,
      }),
    BadRequestException,
  );
});

test('parses an external participant with optional typed contact', () => {
  assert.deepEqual(
    parseNegotiationParticipantCreate({
      kind: 'external',
      role: 'carrier',
      businessPartyId: partyId,
      businessPartyContactId: contactId,
    }),
    {
      kind: 'external',
      role: 'carrier',
      membershipId: null,
      businessPartyId: partyId,
      businessPartyContactId: contactId,
    },
  );
});

test('defaults user-authored messages to message and preserves references', () => {
  assert.deepEqual(
    parseNegotiationMessageCreate({
      body: '  Podemos fechar em R$ 3.500?  ',
      relatedProposalId: proposalId,
      replyToMessageId: messageId,
    }),
    {
      kind: 'message',
      body: 'Podemos fechar em R$ 3.500?',
      relatedProposalId: proposalId,
      replyToMessageId: messageId,
    },
  );
});

test('does not allow clients to forge system messages', () => {
  assert.throws(
    () => parseNegotiationMessageCreate({ kind: 'system', body: 'automatic event' }),
    BadRequestException,
  );
});
