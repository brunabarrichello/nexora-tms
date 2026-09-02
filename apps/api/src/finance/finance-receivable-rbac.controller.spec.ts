import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { TENANT_PERMISSIONS, TENANT_ROLE_TEMPLATES } from '../tenancy/rbac-catalog.js';
import { FinanceReceivableController } from './finance-receivable.controller.js';

const reflector = new Reflector();

test('receivable controller defaults to finance.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, FinanceReceivableController),
    TENANT_PERMISSIONS.FINANCE_READ,
  );
});

test('receivable mutations require finance.write', () => {
  for (const method of [
    FinanceReceivableController.prototype.createReceivable,
    FinanceReceivableController.prototype.updateReceivable,
    FinanceReceivableController.prototype.cancelReceivable,
    FinanceReceivableController.prototype.createTransaction,
  ]) {
    assert.equal(
      reflector.get(REQUIRED_TENANT_PERMISSION, method),
      TENANT_PERMISSIONS.FINANCE_WRITE,
    );
  }
});

test('receivable writes stay restricted to finance manager and tenant admin templates', () => {
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
});
