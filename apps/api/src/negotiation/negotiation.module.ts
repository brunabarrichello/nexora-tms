import { Module } from '@nestjs/common';

import { MatchingModule } from '../matching/matching.module.js';
import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { CapacityReservationController } from './capacity-reservation.controller.js';
import { CapacityReservationService } from './capacity-reservation.service.js';
import { FreightProposalController } from './freight-proposal.controller.js';
import { FreightProposalService } from './freight-proposal.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule, MatchingModule],
  controllers: [FreightProposalController, CapacityReservationController],
  providers: [FreightProposalService, CapacityReservationService, TenantRuntimeGateGuard],
  exports: [FreightProposalService, CapacityReservationService],
})
export class NegotiationModule {}
