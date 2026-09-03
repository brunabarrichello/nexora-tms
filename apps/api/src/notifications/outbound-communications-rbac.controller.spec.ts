import { strict as assert } from 'node:assert';
import test from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import {
  TENANT_PERMISSIONS,
  TENANT_ROLE_TEMPLATES,
  type TenantPermissionKey,
} from '../tenancy/rbac-catalog.js';
import { OutboundCommunicationsController } from './outbound-communications.controller.js';

const reflector = new Reflector();

function hasPermission(
  permissions: readonly TenantPermissionKey[],
  permission: TenantPermissionKey,
): boolean {
  return permissions.includes(permission);
}

test('outbound communication controller defaults to notifications.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, OutboundCommunicationsController),
    TENANT_PERMISSIONS.NOTIFICATIONS_READ,
  );
});

test('outbound communication mutations require notifications.write', () => {
  for (const method of [
    OutboundCommunicationsController.prototype.upsertProviderRoute,
    OutboundCommunicationsController.prototype.createTemplate,
    OutboundCommunicationsController.prototype.setTemplateStatus,
    OutboundCommunicationsController.prototype.upsertPreference,
    OutboundCommunicationsController.prototype.queueCommunication,
  ]) {
    assert.equal(
      reflector.get(REQUIRED_TENANT_PERMISSION, method),
      TENANT_PERMISSIONS.NOTIFICATIONS_WRITE,
    );
  }
});

test('operations and dispatcher may send while finance, auditor and viewer remain read-only', () => {
  assert.equal(
    hasPermission(
      TENANT_ROLE_TEMPLATES.OPERATIONS_MANAGER.permissions,
      TENANT_PERMISSIONS.NOTIFICATIONS_WRITE,
    ),
    true,
  );
  assert.equal(
    hasPermission(
      TENANT_ROLE_TEMPLATES.DISPATCHER.permissions,
      TENANT_PERMISSIONS.NOTIFICATIONS_WRITE,
    ),
    true,
  );
  assert.equal(
    hasPermission(
      TENANT_ROLE_TEMPLATES.FINANCE_MANAGER.permissions,
      TENANT_PERMISSIONS.NOTIFICATIONS_WRITE,
    ),
    false,
  );
  assert.equal(
    hasPermission(TENANT_ROLE_TEMPLATES.AUDITOR.permissions, TENANT_PERMISSIONS.NOTIFICATIONS_WRITE),
    false,
  );
  assert.equal(
    hasPermission(TENANT_ROLE_TEMPLATES.VIEWER.permissions, TENANT_PERMISSIONS.NOTIFICATIONS_WRITE),
    false,
  );
});
