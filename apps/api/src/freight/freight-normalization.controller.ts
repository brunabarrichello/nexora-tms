import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import {
  FreightNormalizationService,
  type FreightNormalizedRecord,
} from './freight-normalization.service.js';

@Controller('api/v1/freight')
@UseGuards(TenantRuntimeGateGuard)
export class FreightNormalizationController {
  constructor(private readonly normalization: FreightNormalizationService) {}

  @Get('transport-requests/:requestId/items')
  listItems(@Param('requestId') requestId: string): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listItems(requestId);
  }

  @Post('transport-requests/:requestId/items')
  createItem(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.createItem(requestId, body);
  }

  @Patch('transport-requests/:requestId/items/:itemId')
  updateItem(
    @Param('requestId') requestId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.updateItem(requestId, itemId, body);
  }

  @Delete('transport-requests/:requestId/items/:itemId')
  deleteItem(
    @Param('requestId') requestId: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    return this.normalization.deleteItem(requestId, itemId);
  }

  @Get('transport-requests/:requestId/packages')
  listPackages(@Param('requestId') requestId: string): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listPackages(requestId);
  }

  @Post('transport-requests/:requestId/packages')
  createPackage(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.createPackage(requestId, body);
  }

  @Patch('transport-requests/:requestId/packages/:packageId')
  updatePackage(
    @Param('requestId') requestId: string,
    @Param('packageId') packageId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.updatePackage(requestId, packageId, body);
  }

  @Delete('transport-requests/:requestId/packages/:packageId')
  deletePackage(
    @Param('requestId') requestId: string,
    @Param('packageId') packageId: string,
  ): Promise<void> {
    return this.normalization.deletePackage(requestId, packageId);
  }

  @Get('transport-requests/:requestId/requirements')
  listRequirements(
    @Param('requestId') requestId: string,
  ): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listRequirements(requestId);
  }

  @Post('transport-requests/:requestId/requirements')
  createRequirement(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.createRequirement(requestId, body);
  }

  @Patch('transport-requests/:requestId/requirements/:requirementId')
  updateRequirement(
    @Param('requestId') requestId: string,
    @Param('requirementId') requirementId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.updateRequirement(requestId, requirementId, body);
  }

  @Delete('transport-requests/:requestId/requirements/:requirementId')
  deleteRequirement(
    @Param('requestId') requestId: string,
    @Param('requirementId') requirementId: string,
  ): Promise<void> {
    return this.normalization.deleteRequirement(requestId, requirementId);
  }

  @Get('transport-requests/:requestId/references')
  listReferences(
    @Param('requestId') requestId: string,
  ): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listReferences(requestId);
  }

  @Post('transport-requests/:requestId/references')
  createReference(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.createReference(requestId, body);
  }

  @Patch('transport-requests/:requestId/references/:referenceId')
  updateReference(
    @Param('requestId') requestId: string,
    @Param('referenceId') referenceId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.updateReference(requestId, referenceId, body);
  }

  @Delete('transport-requests/:requestId/references/:referenceId')
  deleteReference(
    @Param('requestId') requestId: string,
    @Param('referenceId') referenceId: string,
  ): Promise<void> {
    return this.normalization.deleteReference(requestId, referenceId);
  }

  @Get('transport-requests/:requestId/status-history')
  listStatusHistory(
    @Param('requestId') requestId: string,
  ): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listStatusHistory(requestId);
  }

  @Get('transport-requests/:requestId/events')
  listEvents(@Param('requestId') requestId: string): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listEvents(requestId);
  }

  @Post('transport-requests/:requestId/events')
  createEvent(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.createEvent(requestId, body);
  }

  @Get('freight-lanes')
  listLanes(): Promise<readonly FreightNormalizedRecord[]> {
    return this.normalization.listLanes();
  }

  @Post('freight-lanes')
  createLane(@Body() body: unknown): Promise<FreightNormalizedRecord> {
    return this.normalization.createLane(body);
  }

  @Patch('freight-lanes/:laneId')
  updateLane(
    @Param('laneId') laneId: string,
    @Body() body: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.normalization.updateLane(laneId, body);
  }
}
