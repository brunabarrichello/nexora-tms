import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { CapacityAssignmentController } from './capacity-assignment.controller.js';
import { CapacityAssignmentService } from './capacity-assignment.service.js';
import { CapacityAssetController } from './capacity-asset.controller.js';
import { CapacityAssetService } from './capacity-asset.service.js';
import { DriverController } from './driver.controller.js';
import { DriverService } from './driver.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [DriverController, CapacityAssetController, CapacityAssignmentController],
  providers: [
    DriverService,
    CapacityAssetService,
    CapacityAssignmentService,
    TenantRuntimeGateGuard,
  ],
  exports: [DriverService, CapacityAssetService, CapacityAssignmentService],
})
export class CapacityModule {}
