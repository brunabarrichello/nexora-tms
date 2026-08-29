import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { CapacityMatchingController } from './capacity-matching.controller.js';
import { CapacityMatchingService } from './capacity-matching.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [CapacityMatchingController],
  providers: [CapacityMatchingService, TenantRuntimeGateGuard],
  exports: [CapacityMatchingService],
})
export class MatchingModule {}
