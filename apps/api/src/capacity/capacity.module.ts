import { Module } from '@nestjs/common';

import { TenantRuntimeGateModule } from '../tenant-runtime-gate.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { DriverController } from './driver.controller.js';
import { DriverService } from './driver.service.js';

@Module({
  imports: [TenancyModule, TenantRuntimeGateModule],
  controllers: [DriverController],
  providers: [DriverService],
  exports: [DriverService],
})
export class CapacityModule {}
