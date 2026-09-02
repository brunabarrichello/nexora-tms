import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { TripExecutionController } from './trip-execution.controller.js';
import { TripExecutionService } from './trip-execution.service.js';
import { TripOccurrenceController } from './trip-occurrence.controller.js';
import { TripOccurrenceService } from './trip-occurrence.service.js';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [TripsController, TripExecutionController, TripOccurrenceController],
  providers: [TripsService, TripExecutionService, TripOccurrenceService, TenantRuntimeGateGuard],
  exports: [TripsService, TripExecutionService, TripOccurrenceService],
})
export class TripsModule {}
