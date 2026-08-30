import { Module } from '@nestjs/common';

import { MatchingModule } from '../matching/matching.module.js';
import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { FreightProposalController } from './freight-proposal.controller.js';
import { FreightProposalService } from './freight-proposal.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule, MatchingModule],
  controllers: [FreightProposalController],
  providers: [FreightProposalService, TenantRuntimeGateGuard],
  exports: [FreightProposalService],
})
export class NegotiationModule {}
