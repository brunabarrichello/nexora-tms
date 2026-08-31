import { Module } from '@nestjs/common';

import { TenantAuthorizationService } from './tenant-authorization.service.js';
import { TenantContextGuard } from './tenant-context.guard.js';
import { TenantContext } from './tenant-context.js';
import { TenantDatabaseService } from './tenant-database.service.js';
import { TenantMembershipService } from './tenant-membership.service.js';
import { TenantPermissionGuard } from './tenant-permission.guard.js';
import { TenantPermissionService } from './tenant-permission.service.js';

@Module({
  providers: [
    TenantAuthorizationService,
    TenantContext,
    TenantContextGuard,
    TenantDatabaseService,
    TenantMembershipService,
    TenantPermissionGuard,
    TenantPermissionService,
  ],
  exports: [
    TenantAuthorizationService,
    TenantContext,
    TenantContextGuard,
    TenantDatabaseService,
    TenantPermissionGuard,
    TenantPermissionService,
  ],
})
export class TenancyModule {}
