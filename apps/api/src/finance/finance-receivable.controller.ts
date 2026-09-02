import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { FinanceReceivableService } from './finance-receivable.service.js';
import type {
  CustomerReceivableEventRecord,
  CustomerReceivableRecord,
  CustomerReceivableTransactionRecord,
} from './finance-receivable.types.js';

@Controller('api/v1/finance/receivables')
@TenantAuthorized('finance.read')
export class FinanceReceivableController {
  constructor(private readonly receivables: FinanceReceivableService) {}

  @Get('titles')
  listReceivables(): Promise<readonly CustomerReceivableRecord[]> {
    return this.receivables.listReceivables();
  }

  @Post('titles')
  @TenantAuthorized('finance.write')
  createReceivable(@Body() body: unknown): Promise<CustomerReceivableRecord> {
    return this.receivables.createReceivable(body);
  }

  @Get('titles/:receivableId')
  getReceivable(@Param('receivableId') receivableId: string): Promise<CustomerReceivableRecord> {
    return this.receivables.getReceivable(receivableId);
  }

  @Patch('titles/:receivableId')
  @TenantAuthorized('finance.write')
  updateReceivable(
    @Param('receivableId') receivableId: string,
    @Body() body: unknown,
  ): Promise<CustomerReceivableRecord> {
    return this.receivables.updateReceivable(receivableId, body);
  }

  @Post('titles/:receivableId/cancel')
  @TenantAuthorized('finance.write')
  cancelReceivable(
    @Param('receivableId') receivableId: string,
    @Body() body: unknown,
  ): Promise<CustomerReceivableRecord> {
    return this.receivables.cancelReceivable(receivableId, body);
  }

  @Get('titles/:receivableId/transactions')
  listTransactions(
    @Param('receivableId') receivableId: string,
  ): Promise<readonly CustomerReceivableTransactionRecord[]> {
    return this.receivables.listTransactions(receivableId);
  }

  @Post('titles/:receivableId/transactions')
  @TenantAuthorized('finance.write')
  createTransaction(
    @Param('receivableId') receivableId: string,
    @Body() body: unknown,
  ): Promise<CustomerReceivableTransactionRecord> {
    return this.receivables.createTransaction(receivableId, body);
  }

  @Get('titles/:receivableId/events')
  listEvents(
    @Param('receivableId') receivableId: string,
  ): Promise<readonly CustomerReceivableEventRecord[]> {
    return this.receivables.listEvents(receivableId);
  }
}
