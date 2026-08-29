import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCreateDriver,
  parseUpdateDriver,
  validateDriverStatusCombination,
} from './driver.validation.js';

const valid = {
  fullName: 'João da Silva',
  taxId: '123.456.789-01',
  phone: '11999999999',
  whatsapp: '11999999999',
  email: 'joao@example.test',
  cnhNumber: '12345678901',
  cnhCategory: 'AE',
  cnhExpiresOn: '2029-12-31',
  registrationStatus: 'qualified',
  operationalStatus: 'active',
};

test('normalizes CPF and accepts qualified active driver', () => {
  const driver = parseCreateDriver(valid);
  assert.equal(driver.taxId, '12345678901');
  assert.equal(driver.cnhCategory, 'AE');
  assert.equal(driver.registrationStatus, 'qualified');
  assert.equal(driver.operationalStatus, 'active');
});

test('allows pending driver to be operationally inactive without a reason', () => {
  const driver = parseCreateDriver({
    ...valid,
    registrationStatus: undefined,
    operationalStatus: undefined,
  });
  assert.equal(driver.registrationStatus, 'pending');
  assert.equal(driver.operationalStatus, 'inactive');
  assert.equal(driver.statusReason, null);
});

test('rejects active driver that is not qualified', () => {
  assert.throws(
    () => parseCreateDriver({ ...valid, registrationStatus: 'pending' }),
    /requires registrationStatus qualified/,
  );
});

test('requires reason for blocked driver', () => {
  assert.throws(
    () => parseCreateDriver({ ...valid, operationalStatus: 'blocked' }),
    /statusReason is required/,
  );
});

test('rejects invalid CNH category and malformed dates', () => {
  assert.throws(() => parseCreateDriver({ ...valid, cnhCategory: 'X' }), /cnhCategory/);
  assert.throws(() => parseCreateDriver({ ...valid, cnhExpiresOn: '31-12-2029' }), /YYYY-MM-DD/);
});

test('requires at least one field in update', () => {
  assert.throws(() => parseUpdateDriver({}), /At least one field/);
});

test('validates the final merged status combination', () => {
  assert.doesNotThrow(() => validateDriverStatusCombination('qualified', 'inactive', null));
  assert.throws(() => validateDriverStatusCombination('blocked', 'inactive', null), /statusReason/);
});
