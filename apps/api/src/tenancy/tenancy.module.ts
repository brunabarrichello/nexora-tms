import { Module } from '@nestjs/common';

import { TenantAuthorizationService } from './tenant-authorization.service.js';
import { TenantContextGuard } from './tenant-context.guard.js';
import { TenantContext } from './tenant-context.js';
import { TenantDatabaseService } from './tenant-database.service.js';
import { TenantMembershipService } from './tenant-membership.service.js';

@Module({
  providers: [
    TenantAuthorizationService,
    TenantContext,
    TenantContextGuard,
    TenantDatabaseService,
    TenantMembershipService,
  ],
  exports: [TenantAuthorizationService, TenantContext, TenantContextGuard, TenantDatabaseService],
})
export class TenancyModule {}
