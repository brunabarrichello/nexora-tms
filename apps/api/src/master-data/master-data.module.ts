import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { BusinessPartyController } from './business-party.controller.js';
import { BusinessPartyService } from './business-party.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [BusinessPartyController],
  providers: [BusinessPartyService, TenantRuntimeGateGuard],
})
export class MasterDataModule {}
