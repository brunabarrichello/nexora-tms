import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { FinancePaymentService } from './finance-payment.service.js';
import type {
  CarrierPaymentEventRecord,
  CarrierPaymentObligationRecord,
  CarrierPaymentTransactionRecord,
} from './finance-payment.types.js';

@Controller('api/v1/finance/payments')
@TenantAuthorized('finance.read')
export class FinancePaymentController {
  constructor(private readonly payments: FinancePaymentService) {}

  @Get('obligations')
  listObligations(): Promise<readonly CarrierPaymentObligationRecord[]> {
    return this.payments.listObligations();
  }

  @Post('obligations')
  @TenantAuthorized('finance.write')
  createObligation(@Body() body: unknown): Promise<CarrierPaymentObligationRecord> {
    return this.payments.createObligation(body);
  }

  @Get('obligations/:obligationId')
  getObligation(
    @Param('obligationId') obligationId: string,
  ): Promise<CarrierPaymentObligationRecord> {
    return this.payments.getObligation(obligationId);
  }

  @Patch('obligations/:obligationId')
  @TenantAuthorized('finance.write')
  updateObligation(
    @Param('obligationId') obligationId: string,
    @Body() body: unknown,
  ): Promise<CarrierPaymentObligationRecord> {
    return this.payments.updateObligation(obligationId, body);
  }

  @Post('obligations/:obligationId/cancel')
  @TenantAuthorized('finance.write')
  cancelObligation(
    @Param('obligationId') obligationId: string,
    @Body() body: unknown,
  ): Promise<CarrierPaymentObligationRecord> {
    return this.payments.cancelObligation(obligationId, body);
  }

  @Get('obligations/:obligationId/transactions')
  listTransactions(
    @Param('obligationId') obligationId: string,
  ): Promise<readonly CarrierPaymentTransactionRecord[]> {
    return this.payments.listTransactions(obligationId);
  }

  @Post('obligations/:obligationId/transactions')
  @TenantAuthorized('finance.write')
  createTransaction(
    @Param('obligationId') obligationId: string,
    @Body() body: unknown,
  ): Promise<CarrierPaymentTransactionRecord> {
    return this.payments.createTransaction(obligationId, body);
  }

  @Get('obligations/:obligationId/events')
  listEvents(
    @Param('obligationId') obligationId: string,
  ): Promise<readonly CarrierPaymentEventRecord[]> {
    return this.payments.listEvents(obligationId);
  }
}
