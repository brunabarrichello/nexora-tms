import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { TENANT_PERMISSIONS, TENANT_ROLE_TEMPLATES } from '../tenancy/rbac-catalog.js';
import { AsyncAdminController } from './async-admin.controller.js';

const reflector = new Reflector();

test('async administrative reads require audit.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, AsyncAdminController),
    TENANT_PERMISSIONS.AUDIT_READ,
  );
});

test('async reprocessing requires tenant.manage', () => {
  for (const method of [
    AsyncAdminController.prototype.reprocessOutbox,
    AsyncAdminController.prototype.reprocessJob,
  ]) {
    assert.equal(
      reflector.get(REQUIRED_TENANT_PERMISSION, method),
      TENANT_PERMISSIONS.TENANT_MANAGE,
    );
  }
});

test('tenant.manage is available only to tenant admin among built-in role templates', () => {
  assert.equal(
    (TENANT_ROLE_TEMPLATES.TENANT_ADMIN.permissions as readonly string[]).includes(
      TENANT_PERMISSIONS.TENANT_MANAGE,
    ),
    true,
  );

  for (const role of [
    TENANT_ROLE_TEMPLATES.OPERATIONS_MANAGER,
    TENANT_ROLE_TEMPLATES.DISPATCHER,
    TENANT_ROLE_TEMPLATES.FINANCE_MANAGER,
    TENANT_ROLE_TEMPLATES.AUDITOR,
    TENANT_ROLE_TEMPLATES.VIEWER,
  ]) {
    assert.equal(
      (role.permissions as readonly string[]).includes(TENANT_PERMISSIONS.TENANT_MANAGE),
      false,
    );
  }
});
