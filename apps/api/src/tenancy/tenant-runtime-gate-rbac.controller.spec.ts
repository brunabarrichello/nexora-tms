import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from './tenant-permission.guard.js';
import { TenantRuntimeGateController } from './tenant-runtime-gate.controller.js';

const reflector = new Reflector();

test('Tenant runtime gate requires tenant.read permission', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, TenantRuntimeGateController),
    'tenant.read',
  );
});
