import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { FinanceMarginController } from './finance-margin.controller.js';
import { FinanceMarginService } from './finance-margin.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [FinanceMarginController],
  providers: [FinanceMarginService, TenantRuntimeGateGuard],
  exports: [FinanceMarginService],
})
export class FinanceModule {}
