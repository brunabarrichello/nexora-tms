import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';

import type { TenantPermissionKey } from '../tenancy/rbac-catalog.js';
import {
  REQUIRED_TENANT_PERMISSION,
  TenantPermissionGuard,
} from '../tenancy/tenant-permission.guard.js';
import { TenantContextGuard } from '../tenancy/tenant-context.guard.js';
import { OidcAuthenticationGuard } from './oidc-authentication.guard.js';

export const TenantAuthorized = (permissionKey: TenantPermissionKey) =>
  applyDecorators(
    SetMetadata(REQUIRED_TENANT_PERMISSION, permissionKey),
    UseGuards(OidcAuthenticationGuard, TenantContextGuard, TenantPermissionGuard),
  );
