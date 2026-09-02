import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { FinanceMarginController } from './finance-margin.controller.js';
import { FinanceMarginService } from './finance-margin.service.js';
import { FinancePaymentController } from './finance-payment.controller.js';
import { FinancePaymentService } from './finance-payment.service.js';
import { FinanceReceivableController } from './finance-receivable.controller.js';
import { FinanceReceivableService } from './finance-receivable.service.js';
import { FinanceReconciliationController } from './finance-reconciliation.controller.js';
import { FinanceReconciliationService } from './finance-reconciliation.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [
    FinanceMarginController,
    FinancePaymentController,
    FinanceReceivableController,
    FinanceReconciliationController,
  ],
  providers: [
    FinanceMarginService,
    FinancePaymentService,
    FinanceReceivableService,
    FinanceReconciliationService,
    TenantRuntimeGateGuard,
  ],
  exports: [
    FinanceMarginService,
    FinancePaymentService,
    FinanceReceivableService,
    FinanceReconciliationService,
  ],
})
export class FinanceModule {}
