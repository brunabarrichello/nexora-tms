import { Controller, Get, Param } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { FinanceMarginService, type OperationMarginRecord } from './finance-margin.service.js';

@Controller('api/v1/finance/margins')
@TenantAuthorized('finance.read')
export class FinanceMarginController {
  constructor(private readonly margins: FinanceMarginService) {}

  @Get()
  list(): Promise<readonly OperationMarginRecord[]> {
    return this.margins.list();
  }

  @Get(':transportRequestId')
  get(@Param('transportRequestId') transportRequestId: string): Promise<OperationMarginRecord> {
    return this.margins.get(transportRequestId);
  }
}
