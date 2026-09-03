import assert from 'node:assert/strict';
import test from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { TENANT_PERMISSIONS } from '../tenancy/rbac-catalog.js';
import { OperationalAnalyticsController } from './operational-analytics.controller.js';

const reflector = new Reflector();

test('operational analytics controller requires trips.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, OperationalAnalyticsController),
    TENANT_PERMISSIONS.TRIPS_READ,
  );
});
