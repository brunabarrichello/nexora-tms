import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseFreightCounterproposal,
  parseFreightProposalCreate,
  parseFreightProposalStatus,
} from './freight-proposal.validation.js';

const assignmentId = '52000000-0000-4000-8000-000000000921';

test('parses an initial proposal with defaults and normalized money', () => {
  const result = parseFreightProposalCreate({
    capacityAssignmentId: assignmentId,
    freightAmount: 9700.129,
    paymentTerms: '70/30 Pix',
  });

  assert.equal(result.capacityAssignmentId, assignmentId);
  assert.equal(result.currencyCode, 'BRL');
  assert.equal(result.freightAmount, 9700.13);
  assert.equal(result.tollAmount, 0);
  assert.equal(result.additionalAmount, 0);
  assert.equal(result.paymentTerms, '70/30 Pix');
  assert.equal(result.expiresAt, null);
});

test('parses a counterproposal without changing the capacity identity', () => {
  const result = parseFreightCounterproposal({
    currencyCode: 'brl',
    freightAmount: 10000,
    tollAmount: 313.8,
    additionalAmount: 50,
    paymentTerms: '50% coleta / 50% entrega',
    commercialNotes: 'Counteroffer',
  });

  assert.equal(result.currencyCode, 'BRL');
  assert.equal(result.freightAmount, 10000);
  assert.equal(result.tollAmount, 313.8);
  assert.equal(result.additionalAmount, 50);
});

test('requires a reason when a proposal is rejected', () => {
  assert.throws(
    () => parseFreightProposalStatus({ status: 'rejected' }),
    /reason is required when a proposal is rejected/,
  );
});

test('accepts accepted and expired terminal statuses', () => {
  assert.deepEqual(parseFreightProposalStatus({ status: 'accepted' }), {
    status: 'accepted',
    reason: null,
  });
  assert.deepEqual(parseFreightProposalStatus({ status: 'expired', reason: 'Validity ended' }), {
    status: 'expired',
    reason: 'Validity ended',
  });
});

test('rejects an expiration date in the past', () => {
  assert.throws(
    () =>
      parseFreightProposalCreate({
        capacityAssignmentId: assignmentId,
        freightAmount: 1000,
        paymentTerms: 'Pix',
        expiresAt: '2020-01-01T00:00:00Z',
      }),
    /expiresAt must be in the future/,
  );
});
