import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { AsyncAdminController } from './async-admin.controller.js';
import { AsyncAdminService } from './async-admin.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [AsyncAdminController],
  providers: [AsyncAdminService, TenantRuntimeGateGuard],
})
export class ReliabilityModule {}
