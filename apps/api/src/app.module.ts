import { Module } from '@nestjs/common';

import { ApiController } from './api.controller.js';
import { CapacityModule } from './capacity/capacity.module.js';
import { FreightModule } from './freight/freight.module.js';
import { HealthController } from './health.controller.js';
import { MasterDataModule } from './master-data/master-data.module.js';
import { MatchingModule } from './matching/matching.module.js';
import { NegotiationModule } from './negotiation/negotiation.module.js';
import { AuthenticationModule } from './security/authentication.module.js';
import { TenantRuntimeGateModule } from './tenant-runtime-gate.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';

@Module({
  imports: [
    AuthenticationModule,
    TenancyModule,
    TenantRuntimeGateModule,
    MasterDataModule,
    FreightModule,
    CapacityModule,
    MatchingModule,
    NegotiationModule,
  ],
  controllers: [ApiController, HealthController],
})
export class AppModule {}
