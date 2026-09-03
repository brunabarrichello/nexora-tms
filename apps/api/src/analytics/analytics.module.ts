import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { FinancialAnalyticsController } from './financial-analytics.controller.js';
import { FinancialAnalyticsService } from './financial-analytics.service.js';
import { OperationalAnalyticsController } from './operational-analytics.controller.js';
import { OperationalAnalyticsService } from './operational-analytics.service.js';
import { OperationalReportController } from './operational-report.controller.js';
import { OperationalReportService } from './operational-report.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [
    FinancialAnalyticsController,
    OperationalAnalyticsController,
    OperationalReportController,
  ],
  providers: [
    FinancialAnalyticsService,
    OperationalAnalyticsService,
    OperationalReportService,
    TenantRuntimeGateGuard,
  ],
  exports: [FinancialAnalyticsService, OperationalAnalyticsService, OperationalReportService],
})
export class AnalyticsModule {}
