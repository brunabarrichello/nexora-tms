import { Module } from '@nestjs/common';

import { ApiController } from './api.controller.js';
import { HealthController } from './health.controller.js';
import { MasterDataModule } from './master-data/master-data.module.js';
import { AuthenticationModule } from './security/authentication.module.js';
import { TenantRuntimeGateModule } from './tenant-runtime-gate.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';

@Module({
  imports: [AuthenticationModule, TenancyModule, TenantRuntimeGateModule, MasterDataModule],
  controllers: [ApiController, HealthController],
})
export class AppModule {}
