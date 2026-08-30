import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTransportContractReason } from './transport-contract.validation.js';

test('trims refusal and cancellation reasons', () => {
  assert.deepEqual(parseTransportContractReason({ reason: '  Carrier declined final terms  ' }), {
    reason: 'Carrier declined final terms',
  });
});

test('rejects an empty reason', () => {
  assert.throws(() => parseTransportContractReason({ reason: '   ' }), /reason is required/);
});

test('rejects a reason longer than 950 characters', () => {
  assert.throws(
    () => parseTransportContractReason({ reason: 'x'.repeat(951) }),
    /must not exceed 950 characters/,
  );
});
