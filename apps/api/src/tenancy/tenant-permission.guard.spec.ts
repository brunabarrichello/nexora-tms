import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { TenantPermissionGuard } from './tenant-permission.guard.js';
import type { TenantPermissionService } from './tenant-permission.service.js';

function context(): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

function reflector(permission?: string): Reflector {
  return {
    getAllAndOverride: () => permission,
  } as unknown as Reflector;
}

function permissionService(allowed: boolean): TenantPermissionService {
  return {
    hasPermission: async () => allowed,
  } as unknown as TenantPermissionService;
}

test('permission guard denies by default when no permission metadata exists', async () => {
  const guard = new TenantPermissionGuard(reflector(), permissionService(true));

  await assert.rejects(() => guard.canActivate(context()), ForbiddenException);
});

test('permission guard denies when the active membership lacks the required permission', async () => {
  const guard = new TenantPermissionGuard(
    reflector('freight.read'),
    permissionService(false),
  );

  await assert.rejects(() => guard.canActivate(context()), ForbiddenException);
});

test('permission guard allows when the active membership has the required permission', async () => {
  const guard = new TenantPermissionGuard(
    reflector('freight.read'),
    permissionService(true),
  );

  assert.equal(await guard.canActivate(context()), true);
});
