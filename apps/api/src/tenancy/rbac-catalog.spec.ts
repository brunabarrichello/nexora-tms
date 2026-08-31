import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  TENANT_PERMISSIONS,
  TENANT_ROLE_TEMPLATES,
  isTenantPermissionKey,
} from './rbac-catalog.js';

test('permission catalog contains unique stable keys', () => {
  const permissions = Object.values(TENANT_PERMISSIONS);

  assert.equal(new Set(permissions).size, permissions.length);
  for (const permission of permissions) {
    assert.match(permission, /^[a-z][a-z0-9-]*\.(read|write|manage)$/);
    assert.equal(isTenantPermissionKey(permission), true);
  }
});

test('role templates reference only catalog permissions without duplicates', () => {
  for (const role of Object.values(TENANT_ROLE_TEMPLATES)) {
    assert.equal(new Set(role.permissions).size, role.permissions.length);
    for (const permission of role.permissions) {
      assert.equal(isTenantPermissionKey(permission), true);
    }
  }
});

test('tenant admin contains every permission', () => {
  const allPermissions = new Set(Object.values(TENANT_PERMISSIONS));
  const tenantAdminPermissions = new Set(TENANT_ROLE_TEMPLATES.TENANT_ADMIN.permissions);

  assert.deepEqual(tenantAdminPermissions, allPermissions);
});

test('viewer and auditor templates are read-only', () => {
  for (const role of [TENANT_ROLE_TEMPLATES.VIEWER, TENANT_ROLE_TEMPLATES.AUDITOR]) {
    assert.equal(
      role.permissions.some(
        (permission) => permission.endsWith('.write') || permission.endsWith('.manage'),
      ),
      false,
    );
  }
});
