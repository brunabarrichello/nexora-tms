import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { ComplianceRiskService, type ComplianceRiskRecord } from './compliance-risk.service.js';

@Controller('api/v1/compliance-risk')
@TenantAuthorized('documents.read')
export class ComplianceRiskController {
  constructor(private readonly risk: ComplianceRiskService) {}

  @Get(':subjectScope/:subjectId')
  list(
    @Param('subjectScope') subjectScope: string,
    @Param('subjectId') subjectId: string,
  ): Promise<readonly ComplianceRiskRecord[]> {
    return this.risk.list(subjectScope, subjectId);
  }

  @Post('evaluate/:subjectScope/:subjectId')
  @TenantAuthorized('documents.write')
  evaluate(
    @Param('subjectScope') subjectScope: string,
    @Param('subjectId') subjectId: string,
  ): Promise<ComplianceRiskRecord> {
    return this.risk.evaluate(subjectScope, subjectId);
  }

  @Post('assessments/:assessmentId/decision')
  @TenantAuthorized('tenant.manage')
  decide(
    @Param('assessmentId') assessmentId: string,
    @Body() body: unknown,
  ): Promise<ComplianceRiskRecord> {
    return this.risk.decide(assessmentId, body);
  }
}
