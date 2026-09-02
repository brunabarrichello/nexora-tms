import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { DocumentComplianceController } from './document-compliance.controller.js';

const reflector = new Reflector();

test('Compliance controller requires document read permission by default', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, DocumentComplianceController),
    'documents.read',
  );
});

test('Policy and override mutations require tenant administration', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, DocumentComplianceController.prototype.upsertPolicy),
    'tenant.manage',
  );
  assert.equal(
    reflector.get(
      REQUIRED_TENANT_PERMISSION,
      DocumentComplianceController.prototype.createOverride,
    ),
    'tenant.manage',
  );
});
