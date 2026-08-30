import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [TripsController],
  providers: [TripsService, TenantRuntimeGateGuard],
  exports: [TripsService],
})
export class TripsModule {}
