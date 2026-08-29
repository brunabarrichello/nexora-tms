import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { DriverController } from './driver.controller.js';
import { DriverService } from './driver.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [DriverController],
  providers: [DriverService, TenantRuntimeGateGuard],
  exports: [DriverService],
})
export class CapacityModule {}
