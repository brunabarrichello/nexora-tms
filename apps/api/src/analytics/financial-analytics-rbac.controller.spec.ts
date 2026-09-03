import assert from 'node:assert/strict';
import test from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { TENANT_PERMISSIONS } from '../tenancy/rbac-catalog.js';
import { FinancialAnalyticsController } from './financial-analytics.controller.js';

const reflector = new Reflector();

test('financial analytics controller requires finance.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, FinancialAnalyticsController),
    TENANT_PERMISSIONS.FINANCE_READ,
  );
});
