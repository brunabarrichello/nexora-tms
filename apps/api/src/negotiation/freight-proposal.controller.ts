import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { FreightProposalService, type FreightProposal } from './freight-proposal.service.js';

@Controller('api/v1/negotiation')
@TenantAuthorized('negotiation.read')
export class FreightProposalController {
  constructor(private readonly proposals: FreightProposalService) {}

  @Get('requests/:requestId/proposals')
  list(@Param('requestId') requestId: string): Promise<readonly FreightProposal[]> {
    return this.proposals.list(requestId);
  }

  @Post('requests/:requestId/proposals')
  @TenantAuthorized('negotiation.write')
  create(@Param('requestId') requestId: string, @Body() body: unknown): Promise<FreightProposal> {
    return this.proposals.create(requestId, body);
  }

  @Post('proposals/:proposalId/counterproposals')
  @TenantAuthorized('negotiation.write')
  counterproposal(
    @Param('proposalId') proposalId: string,
    @Body() body: unknown,
  ): Promise<FreightProposal> {
    return this.proposals.counterproposal(proposalId, body);
  }

  @Post('proposals/:proposalId/status')
  @TenantAuthorized('negotiation.write')
  setStatus(
    @Param('proposalId') proposalId: string,
    @Body() body: unknown,
  ): Promise<FreightProposal> {
    return this.proposals.setStatus(proposalId, body);
  }
}
