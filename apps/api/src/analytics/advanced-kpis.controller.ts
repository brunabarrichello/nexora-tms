import { Controller, Get, Query } from '@nestjs/common';
import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { AdvancedKpisService, type AdvancedKpisQuery, type AdvancedKpisResult } from './advanced-kpis.service.js';

@Controller('api/v1/analytics/advanced-kpis')
@TenantAuthorized('trips.read')
export class AdvancedKpisController {
  constructor(private readonly kpis: AdvancedKpisService) {}

  @Get()
  get(
    @Query('from') from?: string, @Query('to') to?: string,
    @Query('comparisonFrom') comparisonFrom?: string, @Query('comparisonTo') comparisonTo?: string,
    @Query('customerPartyId') customerPartyId?: string, @Query('origin') origin?: string,
    @Query('destination') destination?: string, @Query('status') status?: string,
  ): Promise<AdvancedKpisResult> {
    const query: AdvancedKpisQuery = { from, to, comparisonFrom, comparisonTo, customerPartyId, origin, destination, status };
    return this.kpis.getAdvancedKpis(query);
  }
}
