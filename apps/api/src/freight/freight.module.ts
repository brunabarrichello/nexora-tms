import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { TransportRequestController } from './transport-request.controller.js';
import { TransportRequestService } from './transport-request.service.js';
import { TransportRouteController } from './transport-route.controller.js';
import { TransportRouteService } from './transport-route.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [TransportRequestController, TransportRouteController],
  providers: [TransportRequestService, TransportRouteService, TenantRuntimeGateGuard],
})
export class FreightModule {}
