import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { TransportRequestController } from './transport-request.controller.js';
import { TransportRequestService } from './transport-request.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [TransportRequestController],
  providers: [TransportRequestService, TenantRuntimeGateGuard],
})
export class FreightModule {}
