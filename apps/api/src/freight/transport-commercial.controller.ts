import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { TransportCommercialService } from './transport-commercial.service.js';
import type { CommercialHistoryView, CommercialTermsView } from './transport-commercial.models.js';

@Controller('api/v1/freight/transport-requests/:requestId/commercial-terms')
export class TransportCommercialController {
  constructor(private readonly commercial: TransportCommercialService) {}

  @Get()
  @TenantAuthorized('freight.read')
  getTerms(@Param('requestId') requestId: string): Promise<CommercialTermsView | null> {
    return this.commercial.getTerms(requestId);
  }

  @Put()
  @TenantAuthorized('freight.write')
  upsertTerms(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<CommercialTermsView> {
    return this.commercial.upsertTerms(requestId, body);
  }

  @Post('status')
  @TenantAuthorized('freight.write')
  changeStatus(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<CommercialTermsView> {
    return this.commercial.changeStatus(requestId, body);
  }

  @Get('history')
  @TenantAuthorized('freight.read')
  getHistory(@Param('requestId') requestId: string): Promise<CommercialHistoryView[]> {
    return this.commercial.getHistory(requestId);
  }
}
