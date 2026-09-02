import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { FinanceReconciliationService } from './finance-reconciliation.service.js';
import type {
  FinancialReconciliationEntryDetail,
  FinancialReconciliationEntryRecord,
  FinancialReconciliationImportRecord,
} from './finance-reconciliation.types.js';

@Controller('api/v1/finance/reconciliation')
@TenantAuthorized('finance.read')
export class FinanceReconciliationController {
  constructor(private readonly reconciliation: FinanceReconciliationService) {}

  @Get('imports')
  listImports(): Promise<readonly FinancialReconciliationImportRecord[]> {
    return this.reconciliation.listImports();
  }

  @Post('imports')
  @TenantAuthorized('finance.write')
  createImport(@Body() body: unknown): Promise<FinancialReconciliationImportRecord> {
    return this.reconciliation.createImport(body);
  }

  @Get('entries')
  listQueue(): Promise<readonly FinancialReconciliationEntryRecord[]> {
    return this.reconciliation.listQueue();
  }

  @Get('entries/:entryId')
  getEntry(@Param('entryId') entryId: string): Promise<FinancialReconciliationEntryDetail> {
    return this.reconciliation.getEntry(entryId);
  }

  @Post('entries/:entryId/suggest')
  @TenantAuthorized('finance.write')
  suggest(@Param('entryId') entryId: string): Promise<FinancialReconciliationEntryDetail> {
    return this.reconciliation.suggest(entryId);
  }

  @Post('entries/:entryId/reconcile')
  @TenantAuthorized('finance.write')
  reconcile(
    @Param('entryId') entryId: string,
    @Body() body: unknown,
  ): Promise<FinancialReconciliationEntryDetail> {
    return this.reconciliation.reconcile(entryId, body);
  }

  @Post('entries/:entryId/ignore')
  @TenantAuthorized('finance.write')
  ignore(
    @Param('entryId') entryId: string,
    @Body() body: unknown,
  ): Promise<FinancialReconciliationEntryDetail> {
    return this.reconciliation.ignore(entryId, body);
  }

  @Post('matches/:matchId/reverse')
  @TenantAuthorized('finance.write')
  reverse(
    @Param('matchId') matchId: string,
    @Body() body: unknown,
  ): Promise<FinancialReconciliationEntryDetail> {
    return this.reconciliation.reverse(matchId, body);
  }
}
