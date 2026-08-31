import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { FreightNormalizationController } from './freight-normalization.controller.js';
import { FreightNormalizationService } from './freight-normalization.service.js';
import { TransportCargoController } from './transport-cargo.controller.js';
import { TransportCargoService } from './transport-cargo.service.js';
import { TransportCommercialController } from './transport-commercial.controller.js';
import { TransportCommercialService } from './transport-commercial.service.js';
import { TransportRequestController } from './transport-request.controller.js';
import { TransportRequestService } from './transport-request.service.js';
import { TransportRouteController } from './transport-route.controller.js';
import { TransportRouteService } from './transport-route.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [
    TransportRequestController,
    TransportRouteController,
    TransportCargoController,
    TransportCommercialController,
    FreightNormalizationController,
  ],
  providers: [
    TransportRequestService,
    TransportRouteService,
    TransportCargoService,
    TransportCommercialService,
    FreightNormalizationService,
    TenantRuntimeGateGuard,
  ],
})
export class FreightModule {}
