import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { ComplianceRiskController } from './compliance-risk.controller.js';

const reflector = new Reflector();

test('Risk controller requires document read permission by default', () => {
  assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, ComplianceRiskController), 'documents.read');
});

test('Risk evaluation and administrative decision use separate permissions', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, ComplianceRiskController.prototype.evaluate),
    'documents.write',
  );
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, ComplianceRiskController.prototype.decide),
    'tenant.manage',
  );
});
