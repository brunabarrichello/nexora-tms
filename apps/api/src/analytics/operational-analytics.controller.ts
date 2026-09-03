import { Controller, Get, Query } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  OperationalAnalyticsService,
  type OperationalDashboardSnapshot,
} from './operational-analytics.service.js';

@Controller('api/v1/analytics')
@TenantAuthorized('trips.read')
export class OperationalAnalyticsController {
  constructor(private readonly analytics: OperationalAnalyticsService) {}

  @Get('operational')
  getOperationalDashboard(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<OperationalDashboardSnapshot> {
    return this.analytics.getOperationalDashboard({ from, to });
  }
}
