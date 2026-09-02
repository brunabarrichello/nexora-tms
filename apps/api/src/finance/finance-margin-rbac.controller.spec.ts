import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { TENANT_PERMISSIONS, TENANT_ROLE_TEMPLATES } from '../tenancy/rbac-catalog.js';
import { FinanceMarginController } from './finance-margin.controller.js';

const reflector = new Reflector();

test('finance margin controller requires finance.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, FinanceMarginController),
    TENANT_PERMISSIONS.FINANCE_READ,
  );
});

test('finance access is not granted to dispatcher or viewer templates', () => {
  assert.equal(
    TENANT_ROLE_TEMPLATES.DISPATCHER.permissions.includes(TENANT_PERMISSIONS.FINANCE_READ),
    false,
  );
  assert.equal(
    TENANT_ROLE_TEMPLATES.VIEWER.permissions.includes(TENANT_PERMISSIONS.FINANCE_READ),
    false,
  );
});

test('finance manager receives finance read access', () => {
  assert.equal(
    TENANT_ROLE_TEMPLATES.FINANCE_MANAGER.permissions.includes(TENANT_PERMISSIONS.FINANCE_READ),
    true,
  );
});
