import { Module } from '@nestjs/common';

import { AuthenticationModule } from './security/authentication.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';
import { TenantRuntimeGateController } from './tenancy/tenant-runtime-gate.controller.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [TenantRuntimeGateController],
})
export class TenantRuntimeGateModule {}
