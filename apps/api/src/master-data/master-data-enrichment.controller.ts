import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import {
  MasterDataEnrichmentService,
  type MasterDataRecord,
} from './master-data-enrichment.service.js';

@Controller('api/v1/master-data')
@UseGuards(TenantRuntimeGateGuard)
export class MasterDataEnrichmentController {
  constructor(private readonly service: MasterDataEnrichmentService) {}

  @Get('locations')
  listLocations(): Promise<readonly MasterDataRecord[]> {
    return this.service.listLocations();
  }

  @Post('locations')
  createLocation(@Body() body: unknown): Promise<MasterDataRecord> {
    return this.service.createLocation(body);
  }

  @Patch('locations/:locationId/lifecycle/:state')
  setLocationLifecycle(
    @Param('locationId') locationId: string,
    @Param('state') state: string,
  ): Promise<MasterDataRecord> {
    return this.service.setLocationLifecycle(locationId, state === 'active');
  }

  @Get('dimensions/:kind')
  listDimensions(@Param('kind') kind: string): Promise<readonly MasterDataRecord[]> {
    return this.service.listDimensions(kind);
  }

  @Post('dimensions/:kind')
  createDimension(@Param('kind') kind: string, @Body() body: unknown): Promise<MasterDataRecord> {
    return this.service.createDimension(kind, body);
  }

  @Get('commodities')
  listCommodities(): Promise<readonly MasterDataRecord[]> {
    return this.service.listCommodities();
  }

  @Post('commodities')
  createCommodity(@Body() body: unknown): Promise<MasterDataRecord> {
    return this.service.createCommodity(body);
  }

  @Get('business-party-groups')
  listPartyGroups(): Promise<readonly MasterDataRecord[]> {
    return this.service.listPartyGroups();
  }

  @Post('business-party-groups')
  createPartyGroup(@Body() body: unknown): Promise<MasterDataRecord> {
    return this.service.createPartyGroup(body);
  }

  @Put('business-party-groups/:groupId/members/:partyId/:state')
  async setPartyGroupMembership(
    @Param('groupId') groupId: string,
    @Param('partyId') partyId: string,
    @Param('state') state: string,
  ): Promise<{ readonly active: boolean }> {
    const active = state === 'active';
    await this.service.setPartyGroupMembership(groupId, partyId, active);
    return { active };
  }

  @Get('business-parties/:partyId/requirements')
  listPartyRequirements(@Param('partyId') partyId: string): Promise<readonly MasterDataRecord[]> {
    return this.service.listPartyRequirements(partyId);
  }

  @Post('business-parties/:partyId/requirements')
  createPartyRequirement(
    @Param('partyId') partyId: string,
    @Body() body: unknown,
  ): Promise<MasterDataRecord> {
    return this.service.createPartyRequirement(partyId, body);
  }

  @Get('custom-fields/definitions')
  listCustomFieldDefinitions(): Promise<readonly MasterDataRecord[]> {
    return this.service.listCustomFieldDefinitions();
  }

  @Post('custom-fields/definitions')
  createCustomFieldDefinition(@Body() body: unknown): Promise<MasterDataRecord> {
    return this.service.createCustomFieldDefinition(body);
  }

  @Put('custom-fields/:definitionId/:entityType/:subjectId')
  setCustomFieldValue(
    @Param('definitionId') definitionId: string,
    @Param('entityType') entityType: string,
    @Param('subjectId') subjectId: string,
    @Body() body: unknown,
  ): Promise<MasterDataRecord> {
    const value =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).value
        : undefined;
    return this.service.setCustomFieldValue(definitionId, entityType, subjectId, value);
  }

  @Put('tags/:entityType/:subjectId/:tagId/:state')
  async setTag(
    @Param('entityType') entityType: string,
    @Param('subjectId') subjectId: string,
    @Param('tagId') tagId: string,
    @Param('state') state: string,
  ): Promise<{ readonly active: boolean }> {
    const active = state === 'active';
    await this.service.setTag(entityType, subjectId, tagId, active);
    return { active };
  }

  @Post('sequences/:scope/allocate')
  allocateSequence(@Param('scope') scope: string): Promise<{ readonly value: string }> {
    return this.service.allocateSequence(scope);
  }

  @Put('configuration/:kind/:key')
  upsertTenantConfiguration(
    @Param('kind') kindInput: string,
    @Param('key') key: string,
    @Body() body: unknown,
  ): Promise<MasterDataRecord> {
    const kind = kindInput === 'feature' ? 'feature' : 'module';
    return this.service.upsertTenantConfiguration(kind, key, body);
  }
}
