import { Controller, Get, Query } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  OperationalReportService,
  type OperationalReportResult,
} from './operational-report.service.js';

@Controller('api/v1/analytics')
@TenantAuthorized('trips.read')
export class OperationalReportController {
  constructor(private readonly report: OperationalReportService) {}

  @Get('operational-report')
  getOperationalReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('customerPartyId') customerPartyId?: string,
    @Query('origin') origin?: string,
    @Query('destination') destination?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<OperationalReportResult> {
    return this.report.getReport({
      from,
      to,
      customerPartyId,
      origin,
      destination,
      status,
      page,
      pageSize,
    });
  }
}
