import { Module } from '@nestjs/common';

import { MatchingModule } from '../matching/matching.module.js';
import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { CapacityReservationController } from './capacity-reservation.controller.js';
import { CapacityReservationService } from './capacity-reservation.service.js';
import { FreightProposalController } from './freight-proposal.controller.js';
import { FreightProposalService } from './freight-proposal.service.js';
import { TransportContractController } from './transport-contract.controller.js';
import { TransportContractService } from './transport-contract.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule, MatchingModule],
  controllers: [
    FreightProposalController,
    CapacityReservationController,
    TransportContractController,
  ],
  providers: [
    FreightProposalService,
    CapacityReservationService,
    TransportContractService,
    TenantRuntimeGateGuard,
  ],
  exports: [FreightProposalService, CapacityReservationService, TransportContractService],
})
export class NegotiationModule {}
