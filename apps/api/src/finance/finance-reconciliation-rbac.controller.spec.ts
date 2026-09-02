import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { TENANT_PERMISSIONS, TENANT_ROLE_TEMPLATES } from '../tenancy/rbac-catalog.js';
import { FinanceReconciliationController } from './finance-reconciliation.controller.js';

const reflector = new Reflector();

test('reconciliation controller defaults to finance.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, FinanceReconciliationController),
    TENANT_PERMISSIONS.FINANCE_READ,
  );
});

test('reconciliation mutations require finance.write', () => {
  for (const method of [
    FinanceReconciliationController.prototype.createImport,
    FinanceReconciliationController.prototype.suggest,
    FinanceReconciliationController.prototype.reconcile,
    FinanceReconciliationController.prototype.ignore,
    FinanceReconciliationController.prototype.reverse,
  ]) {
    assert.equal(
      reflector.get(REQUIRED_TENANT_PERMISSION, method),
      TENANT_PERMISSIONS.FINANCE_WRITE,
    );
  }
});

test('finance write remains restricted to finance manager and tenant admin templates', () => {
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
