import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { TripExecutionController } from './trip-execution.controller.js';
import { TripExecutionService } from './trip-execution.service.js';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [TripsController, TripExecutionController],
  providers: [TripsService, TripExecutionService, TenantRuntimeGateGuard],
  exports: [TripsService, TripExecutionService],
})
export class TripsModule {}
