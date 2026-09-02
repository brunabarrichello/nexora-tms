import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  parseCancelCustomerReceivable,
  parseCreateCustomerReceivable,
  parseCreateCustomerReceivableTransaction,
  parseUpdateCustomerReceivable,
} from './finance-receivable.validation.js';

const REQUEST = '76000000-0000-4000-8000-000000000701';
const TRANSACTION = '76000000-0000-4000-8000-000000000941';

test('create receivable normalizes money and date', () => {
  const value = parseCreateCustomerReceivable({
    transportRequestId: REQUEST,
    invoicedAmount: 19000,
    dueAt: '2026-10-01T12:00:00Z',
  });
  assert.equal(value.invoicedAmount, '19000.00');
  assert.equal(value.dueAt, '2026-10-01T12:00:00.000Z');
});

test('update receivable requires at least one mutable field', () => {
  assert.throws(() => parseUpdateCustomerReceivable({}), /at least one receivable field/);
});

test('receipt rejects related transaction', () => {
  assert.throws(
    () =>
      parseCreateCustomerReceivableTransaction({
        kind: 'receipt',
        amount: '10.00',
        relatedTransactionId: TRANSACTION,
      }),
    /receipt cannot reference relatedTransactionId/,
  );
});

test('reversal requires related transaction', () => {
  assert.throws(
    () => parseCreateCustomerReceivableTransaction({ kind: 'reversal', amount: '10.00' }),
    /reversal requires relatedTransactionId/,
  );
});

test('cancel reason requires operational context', () => {
  assert.throws(() => parseCancelCustomerReceivable({ reason: 'short' }), /at least 10 characters/);
  assert.equal(
    parseCancelCustomerReceivable({ reason: 'Invoice cancelled by finance' }).reason,
    'Invoice cancelled by finance',
  );
});
