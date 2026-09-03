import { Controller, Get, Query } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  FinancialAnalyticsService,
  type FinancialIndicatorsSnapshot,
} from './financial-analytics.service.js';

@Controller('api/v1/analytics/financial')
@TenantAuthorized('finance.read')
export class FinancialAnalyticsController {
  constructor(private readonly financial: FinancialAnalyticsService) {}

  @Get()
  get(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('customerPartyId') customerPartyId?: string,
  ): Promise<FinancialIndicatorsSnapshot> {
    return this.financial.getFinancialIndicators({ from, to, customerPartyId });
  }
}
