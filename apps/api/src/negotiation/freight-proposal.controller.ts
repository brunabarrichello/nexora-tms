import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { FreightProposalService, type FreightProposal } from './freight-proposal.service.js';

@Controller('api/v1/negotiation')
@UseGuards(TenantRuntimeGateGuard)
export class FreightProposalController {
  constructor(private readonly proposals: FreightProposalService) {}

  @Get('requests/:requestId/proposals')
  list(@Param('requestId') requestId: string): Promise<readonly FreightProposal[]> {
    return this.proposals.list(requestId);
  }

  @Post('requests/:requestId/proposals')
  create(@Param('requestId') requestId: string, @Body() body: unknown): Promise<FreightProposal> {
    return this.proposals.create(requestId, body);
  }

  @Post('proposals/:proposalId/counterproposals')
  counterproposal(
    @Param('proposalId') proposalId: string,
    @Body() body: unknown,
  ): Promise<FreightProposal> {
    return this.proposals.counterproposal(proposalId, body);
  }

  @Post('proposals/:proposalId/status')
  setStatus(
    @Param('proposalId') proposalId: string,
    @Body() body: unknown,
  ): Promise<FreightProposal> {
    return this.proposals.setStatus(proposalId, body);
  }
}
