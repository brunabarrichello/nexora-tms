import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { TENANT_PERMISSIONS, TENANT_ROLE_TEMPLATES } from '../tenancy/rbac-catalog.js';
import { FinancePaymentController } from './finance-payment.controller.js';

const reflector = new Reflector();

test('payment controller defaults to finance.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, FinancePaymentController),
    TENANT_PERMISSIONS.FINANCE_READ,
  );
});

test('payment mutations require finance.write', () => {
  for (const method of [
    FinancePaymentController.prototype.createObligation,
    FinancePaymentController.prototype.updateObligation,
    FinancePaymentController.prototype.cancelObligation,
    FinancePaymentController.prototype.createTransaction,
  ]) {
    assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, method), TENANT_PERMISSIONS.FINANCE_WRITE);
  }
});

test('finance write is restricted to finance manager and tenant admin templates', () => {
  assert.equal(
    (TENANT_ROLE_TEMPLATES.FINANCE_MANAGER.permissions as readonly string[]).includes(
      TENANT_PERMISSIONS.FINANCE_WRITE,
    ),
    true,
  );
  assert.equal(
    (TENANT_ROLE_TEMPLATES.OPERATIONS_MANAGER.permissions as readonly string[]).includes(
      TENANT_PERMISSIONS.FINANCE_WRITE,
    ),
    false,
  );
  assert.equal(
    (TENANT_ROLE_TEMPLATES.AUDITOR.permissions as readonly string[]).includes(
      TENANT_PERMISSIONS.FINANCE_WRITE,
    ),
    false,
  );
  assert.equal(
    (TENANT_ROLE_TEMPLATES.VIEWER.permissions as readonly string[]).includes(
      TENANT_PERMISSIONS.FINANCE_WRITE,
    ),
    false,
  );
});
