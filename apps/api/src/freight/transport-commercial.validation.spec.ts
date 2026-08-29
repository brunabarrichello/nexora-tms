import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCommercialStatus, parseCommercialTerms } from './transport-commercial.validation.js';

const validTerms = {
  customerPrice: 18500,
  targetCarrierFreight: 16000,
  tollAmount: 313.8,
  additionalAmount: 250,
  paymentTerms: '70% coleta / 30% entrega via Pix',
  commercialNotes: 'Valor máximo da operação',
};

test('parses commercial terms with BRL defaults', () => {
  const terms = parseCommercialTerms(validTerms);
  assert.equal(terms.currencyCode, 'BRL');
  assert.equal(terms.customerPrice, 18500);
  assert.equal(terms.targetCarrierFreight, 16000);
  assert.equal(terms.tollAmount, 313.8);
  assert.equal(terms.additionalAmount, 250);
});

test('allows customer price to be omitted', () => {
  const terms = parseCommercialTerms({ ...validTerms, customerPrice: undefined });
  assert.equal(terms.customerPrice, null);
});

test('rejects non-positive target carrier freight', () => {
  assert.throws(
    () => parseCommercialTerms({ ...validTerms, targetCarrierFreight: 0 }),
    /targetCarrierFreight/,
  );
});

test('rejects negative tolls and additions', () => {
  assert.throws(() => parseCommercialTerms({ ...validTerms, tollAmount: -1 }), /tollAmount/);
  assert.throws(
    () => parseCommercialTerms({ ...validTerms, additionalAmount: -1 }),
    /additionalAmount/,
  );
});

test('accepts the approval workflow statuses', () => {
  assert.equal(parseCommercialStatus({ status: 'pending_approval' }).status, 'pending_approval');
  assert.equal(parseCommercialStatus({ status: 'approved', note: 'Approved margin' }).status, 'approved');
  assert.equal(parseCommercialStatus({ status: 'rejected', note: 'Adjust carrier target' }).status, 'rejected');
});

test('requires a reason to reject commercial terms', () => {
  assert.throws(() => parseCommercialStatus({ status: 'rejected' }), /note is required/);
});
