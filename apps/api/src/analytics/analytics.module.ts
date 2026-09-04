import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { AdvancedKpisController } from './advanced-kpis.controller.js';
import { AdvancedKpisService } from './advanced-kpis.service.js';
import { FinancialAnalyticsController } from './financial-analytics.controller.js';
import { FinancialAnalyticsService } from './financial-analytics.service.js';
import { OperationalAnalyticsController } from './operational-analytics.controller.js';
import { OperationalAnalyticsService } from './operational-analytics.service.js';
import { OperationalReportController } from './operational-report.controller.js';
import { OperationalReportService } from './operational-report.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [
    AdvancedKpisController,
    FinancialAnalyticsController,
    OperationalAnalyticsController,
    OperationalReportController,
  ],
  providers: [
    AdvancedKpisService,
    FinancialAnalyticsService,
    OperationalAnalyticsService,
    OperationalReportService,
    TenantRuntimeGateGuard,
  ],
  exports: [
    AdvancedKpisService,
    FinancialAnalyticsService,
    OperationalAnalyticsService,
    OperationalReportService,
  ],
})
export class AnalyticsModule {}
