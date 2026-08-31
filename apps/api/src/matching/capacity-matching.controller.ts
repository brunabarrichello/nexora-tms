import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  CapacityMatchingService,
  type CapacityMatchingResult,
} from './capacity-matching.service.js';
import { MatchingPersistenceService } from './matching-persistence.service.js';

interface ExecuteMatchingBody {
  readonly preferenceId?: string;
}

@Controller('api/v1/matching')
@TenantAuthorized('matching.read')
export class CapacityMatchingController {
  constructor(
    private readonly matching: CapacityMatchingService,
    private readonly persistence: MatchingPersistenceService,
  ) {}

  @Get('requests/:requestId/capacity')
  search(@Param('requestId') requestId: string): Promise<CapacityMatchingResult> {
    return this.matching.search(requestId);
  }

  @Post('requests/:requestId/runs')
  @TenantAuthorized('matching.write')
  execute(@Param('requestId') requestId: string, @Body() body: ExecuteMatchingBody = {}) {
    return this.persistence.execute(requestId, body.preferenceId);
  }

  @Get('requests/:requestId/runs')
  listRuns(@Param('requestId') requestId: string) {
    return this.persistence.listRuns(requestId);
  }

  @Get('runs/:runId')
  getRun(@Param('runId') runId: string) {
    return this.persistence.getRun(runId);
  }

  @Get('runs/:runId/candidates')
  listCandidates(@Param('runId') runId: string) {
    return this.persistence.listCandidates(runId);
  }

  @Get('candidates/:candidateId/explanation')
  explainCandidate(@Param('candidateId') candidateId: string) {
    return this.persistence.getCandidateExplanation(candidateId);
  }

  @Get('rules')
  listRules() {
    return this.persistence.listRules();
  }

  @Get('preferences')
  listPreferences() {
    return this.persistence.listPreferences();
  }
}
