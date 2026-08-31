import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { CapacityMatchingController } from './capacity-matching.controller.js';

const reflector = new Reflector();

test('Matching controller defaults to matching.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, CapacityMatchingController),
    'matching.read',
  );
});

test('Matching execution requires matching.write', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, CapacityMatchingController.prototype.execute),
    'matching.write',
  );
});
