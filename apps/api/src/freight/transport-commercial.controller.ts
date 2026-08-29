import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TransportCommercialService } from './transport-commercial.service.js';
import type { CommercialHistoryView, CommercialTermsView } from './transport-commercial.models.js';

@Controller('api/v1/freight/transport-requests/:requestId/commercial-terms')
@UseGuards(TenantRuntimeGateGuard)
export class TransportCommercialController {
  constructor(private readonly commercial: TransportCommercialService) {}

  @Get()
  getTerms(@Param('requestId') requestId: string): Promise<CommercialTermsView | null> {
    return this.commercial.getTerms(requestId);
  }

  @Put()
  upsertTerms(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<CommercialTermsView> {
    return this.commercial.upsertTerms(requestId, body);
  }

  @Post('status')
  changeStatus(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<CommercialTermsView> {
    return this.commercial.changeStatus(requestId, body);
  }

  @Get('history')
  getHistory(@Param('requestId') requestId: string): Promise<CommercialHistoryView[]> {
    return this.commercial.getHistory(requestId);
  }
}
