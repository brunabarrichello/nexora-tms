import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  FreightNormalizationService,
  type FreightNormalizedRecord,
} from './freight-normalization.service.js';

@Controller('api/v1/freight')
export class FreightNormalizationController {
  constructor(private readonly normalization: FreightNormalizationService) {}

  @Get('transport-requests/:requestId/items')
  @TenantAuthorized('freight.read')
  listItems(@Param('requestId') requestId: string): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listItems(requestId);
  }

  @Post('transport-requests/:requestId/items')
  @TenantAuthorized('freight.write')
  createItem(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.createItem(requestId, body);
  }

  @Patch('transport-requests/:requestId/items/:itemId')
  @TenantAuthorized('freight.write')
  updateItem(
    @Param('requestId') requestId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.updateItem(requestId, itemId, body);
  }

  @Delete('transport-requests/:requestId/items/:itemId')
  @TenantAuthorized('freight.write')
  deleteItem(
    @Param('requestId') requestId: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    return this.normalization.deleteItem(requestId, itemId);
  }

  @Get('transport-requests/:requestId/packages')
  @TenantAuthorized('freight.read')
  listPackages(@Param('requestId') requestId: string): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listPackages(requestId);
  }

  @Post('transport-requests/:requestId/packages')
  @TenantAuthorized('freight.write')
  createPackage(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.createPackage(requestId, body);
  }

  @Patch('transport-requests/:requestId/packages/:packageId')
  @TenantAuthorized('freight.write')
  updatePackage(
    @Param('requestId') requestId: string,
    @Param('packageId') packageId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.updatePackage(requestId, packageId, body);
  }

  @Delete('transport-requests/:requestId/packages/:packageId')
  @TenantAuthorized('freight.write')
  deletePackage(
    @Param('requestId') requestId: string,
    @Param('packageId') packageId: string,
  ): Promise<void> {
    return this.normalization.deletePackage(requestId, packageId);
  }

  @Get('transport-requests/:requestId/requirements')
  @TenantAuthorized('freight.read')
  listRequirements(
    @Param('requestId') requestId: string,
  ): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listRequirements(requestId);
  }

  @Post('transport-requests/:requestId/requirements')
  @TenantAuthorized('freight.write')
  createRequirement(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.createRequirement(requestId, body);
  }

  @Patch('transport-requests/:requestId/requirements/:requirementId')
  @TenantAuthorized('freight.write')
  updateRequirement(
    @Param('requestId') requestId: string,
    @Param('requirementId') requirementId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.updateRequirement(requestId, requirementId, body);
  }

  @Delete('transport-requests/:requestId/requirements/:requirementId')
  @TenantAuthorized('freight.write')
  deleteRequirement(
    @Param('requestId') requestId: string,
    @Param('requirementId') requirementId: string,
  ): Promise<void> {
    return this.normalization.deleteRequirement(requestId, requirementId);
  }

  @Get('transport-requests/:requestId/references')
  @TenantAuthorized('freight.read')
  listReferences(
    @Param('requestId') requestId: string,
  ): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listReferences(requestId);
  }

  @Post('transport-requests/:requestId/references')
  @TenantAuthorized('freight.write')
  createReference(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.createReference(requestId, body);
  }

  @Patch('transport-requests/:requestId/references/:referenceId')
  @TenantAuthorized('freight.write')
  updateReference(
    @Param('requestId') requestId: string,
    @Param('referenceId') referenceId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.updateReference(requestId, referenceId, body);
  }

  @Delete('transport-requests/:requestId/references/:referenceId')
  @TenantAuthorized('freight.write')
  deleteReference(
    @Param('requestId') requestId: string,
    @Param('referenceId') referenceId: string,
  ): Promise<void> {
    return this.normalization.deleteReference(requestId, referenceId);
  }

  @Get('transport-requests/:requestId/status-history')
  @TenantAuthorized('freight.read')
  listStatusHistory(
    @Param('requestId') requestId: string,
  ): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listStatusHistory(requestId);
  }

  @Get('transport-requests/:requestId/events')
  @TenantAuthorized('freight.read')
  listEvents(@Param('requestId') requestId: string): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listEvents(requestId);
  }

  @Post('transport-requests/:requestId/events')
  @TenantAuthorized('freight.write')
  createEvent(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.createEvent(requestId, body);
  }

  @Get('freight-lanes')
  @TenantAuthorized('freight.read')
  listLanes(): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listLanes();
  }

  @Post('freight-lanes')
  @TenantAuthorized('freight.write')
  createLane(@Body() body: unknown): Promise<FreightNormalizedRecord> {
    return this.normalization.createLane(body);
  }

  @Patch('freight-lanes/:laneId')
  @TenantAuthorized('freight.write')
  updateLane(
    @Param('laneId') laneId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.updateLane(laneId, body);
  }
}
