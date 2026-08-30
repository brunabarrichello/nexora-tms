import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { BusinessPartyDirectoryController } from './business-party-directory.controller.js';
import { BusinessPartyDirectoryService } from './business-party-directory.service.js';
import { BusinessPartyController } from './business-party.controller.js';
import { BusinessPartyService } from './business-party.service.js';
import { MasterDataEnrichmentController } from './master-data-enrichment.controller.js';
import { MasterDataEnrichmentService } from './master-data-enrichment.service.js';
import { ReferenceDataController } from './reference-data.controller.js';
import { ReferenceDataService } from './reference-data.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [
    BusinessPartyController,
    BusinessPartyDirectoryController,
    MasterDataEnrichmentController,
    ReferenceDataController,
  ],
  providers: [
    BusinessPartyService,
    BusinessPartyDirectoryService,
    MasterDataEnrichmentService,
    ReferenceDataService,
    TenantRuntimeGateGuard,
  ],
})
export class MasterDataModule {}
