import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { TENANT_PERMISSIONS, TENANT_ROLE_TEMPLATES } from '../tenancy/rbac-catalog.js';
import { InAppNotificationsController } from './in-app-notifications.controller.js';

const reflector = new Reflector();

test('notification inbox requires tenant.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, InAppNotificationsController),
    TENANT_PERMISSIONS.TENANT_READ,
  );
});

test('all standard tenant role templates can read their own inbox', () => {
  for (const template of Object.values(TENANT_ROLE_TEMPLATES)) {
    assert.equal(
      (template.permissions as readonly string[]).includes(TENANT_PERMISSIONS.TENANT_READ),
      true,
      `${template.code} should include tenant.read`,
    );
  }
});
