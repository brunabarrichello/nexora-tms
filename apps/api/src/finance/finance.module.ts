import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { FinanceMarginController } from './finance-margin.controller.js';
import { FinanceMarginService } from './finance-margin.service.js';
import { FinancePaymentController } from './finance-payment.controller.js';
import { FinancePaymentService } from './finance-payment.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [FinanceMarginController, FinancePaymentController],
  providers: [FinanceMarginService, FinancePaymentService, TenantRuntimeGateGuard],
  exports: [FinanceMarginService, FinancePaymentService],
})
export class FinanceModule {}
