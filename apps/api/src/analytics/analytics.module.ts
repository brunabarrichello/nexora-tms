import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { OperationalAnalyticsController } from './operational-analytics.controller.js';
import { OperationalAnalyticsService } from './operational-analytics.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [OperationalAnalyticsController],
  providers: [OperationalAnalyticsService, TenantRuntimeGateGuard],
  exports: [OperationalAnalyticsService],
})
export class AnalyticsModule {}
