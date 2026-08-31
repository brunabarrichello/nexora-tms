import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  MasterDataEnrichmentService,
  type MasterDataRecord,
} from './master-data-enrichment.service.js';

function requireLifecycleState(state: string): boolean {
  if (state === 'active') return true;
  if (state === 'inactive') return false;
  throw new BadRequestException('state must be active or inactive');
}

function requireConfigurationKind(kind: string): 'module' | 'feature' {
  if (kind === 'module' || kind === 'feature') return kind;
  throw new BadRequestException('configuration kind must be module or feature');
}

@Controller('api/v1/master-data')
@TenantAuthorized('master-data.read')
export class MasterDataEnrichmentController {
  constructor(private readonly service: MasterDataEnrichmentService) {}

  @Get('locations')
  listLocations(): Promise<readonly MasterDataRecord[]> {
    return this.service.listLocations();
  }

  @Post('locations')
  @TenantAuthorized('master-data.write')
  createLocation(@Body() body: unknown): Promise<MasterDataRecord> {
    return this.service.createLocation(body);
  }

  @Patch('locations/:locationId/lifecycle/:state')
  @TenantAuthorized('master-data.write')
  setLocationLifecycle(
    @Param('locationId') locationId: string,
    @Param('state') state: string,
  ): Promise<MasterDataRecord> {
    return this.service.setLocationLifecycle(locationId, requireLifecycleState(state));
  }

  @Get('dimensions/:kind')
  listDimensions(@Param('kind') kind: string): Promise<readonly MasterDataRecord[]> {
    return this.service.listDimensions(kind);
  }

  @Post('dimensions/:kind')
  @TenantAuthorized('master-data.write')
  createDimension(@Param('kind') kind: string, @Body() body: unknown): Promise<MasterDataRecord> {
    return this.service.createDimension(kind, body);
  }

  @Get('commodities')
  listCommodities(): Promise<readonly MasterDataRecord[]> {
    return this.service.listCommodities();
  }

  @Post('commodities')
  @TenantAuthorized('master-data.write')
  createCommodity(@Body() body: unknown): Promise<MasterDataRecord> {
    return this.service.createCommodity(body);
  }

  @Get('business-party-groups')
  listPartyGroups(): Promise<readonly MasterDataRecord[]> {
    return this.service.listPartyGroups();
  }

  @Post('business-party-groups')
  @TenantAuthorized('master-data.write')
  createPartyGroup(@Body() body: unknown): Promise<MasterDataRecord> {
    return this.service.createPartyGroup(body);
  }

  @Put('business-party-groups/:groupId/members/:partyId/:state')
  @TenantAuthorized('master-data.write')
  async setPartyGroupMembership(
    @Param('groupId') groupId: string,
    @Param('partyId') partyId: string,
    @Param('state') state: string,
  ): Promise<{ readonly active: boolean }> {
    const active = requireLifecycleState(state);
    await this.service.setPartyGroupMembership(groupId, partyId, active);
    return { active };
  }

  @Get('business-parties/:partyId/requirements')
  listPartyRequirements(@Param('partyId') partyId: string): Promise<readonly MasterDataRecord[]> {
    return this.service.listPartyRequirements(partyId);
  }

  @Post('business-parties/:partyId/requirements')
  @TenantAuthorized('master-data.write')
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
  @TenantAuthorized('master-data.write')
  createCustomFieldDefinition(@Body() body: unknown): Promise<MasterDataRecord> {
    return this.service.createCustomFieldDefinition(body);
  }

  @Put('custom-fields/:definitionId/:entityType/:subjectId')
  @TenantAuthorized('master-data.write')
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
  @TenantAuthorized('master-data.write')
  async setTag(
    @Param('entityType') entityType: string,
    @Param('subjectId') subjectId: string,
    @Param('tagId') tagId: string,
    @Param('state') state: string,
  ): Promise<{ readonly active: boolean }> {
    const active = requireLifecycleState(state);
    await this.service.setTag(entityType, subjectId, tagId, active);
    return { active };
  }

  @Post('sequences/:scope/allocate')
  @TenantAuthorized('master-data.write')
  allocateSequence(@Param('scope') scope: string): Promise<{ readonly value: string }> {
    return this.service.allocateSequence(scope);
  }

  @Put('configuration/:kind/:key')
  @TenantAuthorized('master-data.write')
  upsertTenantConfiguration(
    @Param('kind') kindInput: string,
    @Param('key') key: string,
    @Body() body: unknown,
  ): Promise<MasterDataRecord> {
    return this.service.upsertTenantConfiguration(requireConfigurationKind(kindInput), key, body);
  }
}
