import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import {
  BusinessPartyService,
  type BusinessParty,
  type BusinessPartyAuditEntry,
} from './business-party.service.js';

@Controller('api/v1/master-data/business-parties')
@UseGuards(TenantRuntimeGateGuard)
export class BusinessPartyController {
  constructor(private readonly businessParties: BusinessPartyService) {}

  @Get()
  list(): Promise<readonly BusinessParty[]> {
    return this.businessParties.list();
  }

  @Post()
  create(@Body() body: unknown): Promise<BusinessParty> {
    return this.businessParties.create(body);
  }

  @Get(':id/audit')
  audit(@Param('id') id: string): Promise<readonly BusinessPartyAuditEntry[]> {
    return this.businessParties.audit(id);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<BusinessParty> {
    return this.businessParties.getById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown): Promise<BusinessParty> {
    return this.businessParties.update(id, body);
  }
}
