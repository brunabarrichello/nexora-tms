import { Module } from '@nestjs/common';

import { AnalyticsModule } from './analytics/analytics.module.js';
import { ApiController } from './api.controller.js';
import { CapacityModule } from './capacity/capacity.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { FreightModule } from './freight/freight.module.js';
import { HealthController } from './health.controller.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { MasterDataModule } from './master-data/master-data.module.js';
import { MatchingModule } from './matching/matching.module.js';
import { NegotiationModule } from './negotiation/negotiation.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ReliabilityModule } from './reliability/reliability.module.js';
import { AuthenticationModule } from './security/authentication.module.js';
import { TenantRuntimeGateModule } from './tenant-runtime-gate.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';
import { TripsModule } from './trips/trips.module.js';

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
    DocumentsModule,
    TripsModule,
    FinanceModule,
    NotificationsModule,
    ReliabilityModule,
    IntegrationsModule,
    AnalyticsModule,
  ],
  controllers: [ApiController, HealthController],
})
export class AppModule {}
