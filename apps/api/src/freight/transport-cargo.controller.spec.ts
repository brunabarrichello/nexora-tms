import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { TransportCargoController } from './transport-cargo.controller.js';

const reflector = new Reflector();

test('Freight cargo GET requires freight.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, TransportCargoController.prototype.getProfile),
    'freight.read',
  );
});

test('Freight cargo PUT requires freight.write', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, TransportCargoController.prototype.upsertProfile),
    'freight.write',
  );
});
