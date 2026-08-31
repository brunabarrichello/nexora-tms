import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import type { TenantPermissionKey } from '../tenancy/rbac-catalog.js';
import {
  REQUIRED_TENANT_PERMISSION,
  TenantPermissionGuard,
} from '../tenancy/tenant-permission.guard.js';

export const TenantAuthorized = (permissionKey: TenantPermissionKey) =>
  applyDecorators(
    SetMetadata(REQUIRED_TENANT_PERMISSION, permissionKey),
    UseGuards(TenantRuntimeGateGuard, TenantPermissionGuard),
  );
