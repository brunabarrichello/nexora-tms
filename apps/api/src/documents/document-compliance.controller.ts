import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  DocumentComplianceService,
  type DocumentComplianceRecord,
} from './document-compliance.service.js';

@Controller('api/v1/document-compliance')
@TenantAuthorized('documents.read')
export class DocumentComplianceController {
  constructor(private readonly compliance: DocumentComplianceService) {}

  @Get('policies')
  listPolicies(): Promise<readonly DocumentComplianceRecord[]> {
    return this.compliance.listPolicies();
  }

  @Post('policies')
  @TenantAuthorized('tenant.manage')
  upsertPolicy(@Body() body: unknown): Promise<DocumentComplianceRecord> {
    return this.compliance.upsertPolicy(body);
  }

  @Get('overrides')
  listOverrides(): Promise<readonly DocumentComplianceRecord[]> {
    return this.compliance.listOverrides();
  }

  @Post('overrides')
  @TenantAuthorized('tenant.manage')
  createOverride(@Body() body: unknown): Promise<DocumentComplianceRecord> {
    return this.compliance.createOverride(body);
  }

  @Get('evaluate/:subjectScope/:subjectId')
  evaluate(
    @Param('subjectScope') subjectScope: string,
    @Param('subjectId') subjectId: string,
    @Query('context') context = 'trip',
  ): Promise<readonly DocumentComplianceRecord[]> {
    return this.compliance.evaluate(subjectScope, subjectId, context);
  }
}
