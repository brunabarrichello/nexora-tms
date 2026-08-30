import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import {
  CapacityQualificationService,
  type QualificationRecord,
} from './capacity-qualification.service.js';

@Controller('api/v1/capacity')
@UseGuards(TenantRuntimeGateGuard)
export class CapacityQualificationController {
  constructor(private readonly qualification: CapacityQualificationService) {}

  @Get('drivers/:driverId/documents')
  listDriverDocuments(@Param('driverId') driverId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverDocuments(driverId);
  }

  @Post('drivers/:driverId/documents')
  createDriverDocument(@Param('driverId') driverId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createDriverDocument(driverId, body);
  }

  @Get('drivers/:driverId/qualifications')
  listDriverQualifications(@Param('driverId') driverId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverQualifications(driverId);
  }

  @Post('drivers/:driverId/qualifications')
  createDriverQualification(@Param('driverId') driverId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createDriverQualification(driverId, body);
  }

  @Get('drivers/:driverId/courses')
  listDriverCourses(@Param('driverId') driverId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverCourses(driverId);
  }

  @Post('drivers/:driverId/courses')
  createDriverCourse(@Param('driverId') driverId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createDriverCourse(driverId, body);
  }

  @Get('drivers/:driverId/availability')
  getDriverAvailability(@Param('driverId') driverId: string): Promise<QualificationRecord> {
    return this.qualification.getDriverAvailability(driverId);
  }

  @Put('drivers/:driverId/availability')
  setDriverAvailability(@Param('driverId') driverId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.setDriverAvailability(driverId, body);
  }

  @Get('drivers/:driverId/unavailability')
  listDriverUnavailability(@Param('driverId') driverId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverUnavailability(driverId);
  }

  @Post('drivers/:driverId/unavailability')
  createDriverUnavailability(@Param('driverId') driverId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createDriverUnavailability(driverId, body);
  }

  @Get('drivers/:driverId/emergency-contacts')
  listDriverEmergencyContacts(@Param('driverId') driverId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverEmergencyContacts(driverId);
  }

  @Post('drivers/:driverId/emergency-contacts')
  createDriverEmergencyContact(@Param('driverId') driverId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createDriverEmergencyContact(driverId, body);
  }

  @Get('drivers/:driverId/blocks')
  listDriverBlocks(@Param('driverId') driverId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverBlocks(driverId);
  }

  @Post('drivers/:driverId/blocks')
  createDriverBlock(@Param('driverId') driverId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createDriverBlock(driverId, body);
  }

  @Post('drivers/:driverId/blocks/:blockId/release')
  releaseDriverBlock(
    @Param('driverId') driverId: string,
    @Param('blockId') blockId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.releaseDriverBlock(driverId, blockId, body);
  }

  @Get('drivers/:driverId/ratings')
  listDriverRatings(@Param('driverId') driverId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverRatings(driverId);
  }

  @Post('drivers/:driverId/ratings')
  createDriverRating(@Param('driverId') driverId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createDriverRating(driverId, body);
  }

  @Get('assets/:assetId/capabilities')
  getAssetCapabilities(@Param('assetId') assetId: string): Promise<QualificationRecord> {
    return this.qualification.getAssetCapabilities(assetId);
  }

  @Put('assets/:assetId/capabilities')
  setAssetCapabilities(@Param('assetId') assetId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.setAssetCapabilities(assetId, body);
  }

  @Get('assets/:assetId/documents')
  listAssetDocuments(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listAssetDocuments(assetId);
  }

  @Post('assets/:assetId/documents')
  createAssetDocument(@Param('assetId') assetId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createAssetDocument(assetId, body);
  }

  @Get('assets/:assetId/maintenance-plans')
  listMaintenancePlans(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listMaintenancePlans(assetId);
  }

  @Post('assets/:assetId/maintenance-plans')
  createMaintenancePlan(@Param('assetId') assetId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createMaintenancePlan(assetId, body);
  }

  @Get('assets/:assetId/maintenance')
  listMaintenance(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listMaintenance(assetId);
  }

  @Post('assets/:assetId/maintenance')
  createMaintenance(@Param('assetId') assetId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createMaintenance(assetId, body);
  }

  @Get('assets/:assetId/maintenance/:maintenanceId/items')
  listMaintenanceItems(
    @Param('assetId') assetId: string,
    @Param('maintenanceId') maintenanceId: string,
  ): Promise<readonly QualificationRecord[]> {
    return this.qualification.listMaintenanceItems(assetId, maintenanceId);
  }

  @Post('assets/:assetId/maintenance/:maintenanceId/items')
  createMaintenanceItem(
    @Param('assetId') assetId: string,
    @Param('maintenanceId') maintenanceId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createMaintenanceItem(assetId, maintenanceId, body);
  }

  @Get('assets/:assetId/insurances')
  listInsurances(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listInsurances(assetId);
  }

  @Post('assets/:assetId/insurances')
  createInsurance(@Param('assetId') assetId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createInsurance(assetId, body);
  }

  @Get('assets/:assetId/inspections')
  listInspections(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listInspections(assetId);
  }

  @Post('assets/:assetId/inspections')
  createInspection(@Param('assetId') assetId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createInspection(assetId, body);
  }

  @Get('assets/:assetId/availability')
  getAssetAvailability(@Param('assetId') assetId: string): Promise<QualificationRecord> {
    return this.qualification.getAssetAvailability(assetId);
  }

  @Put('assets/:assetId/availability')
  setAssetAvailability(@Param('assetId') assetId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.setAssetAvailability(assetId, body);
  }

  @Get('assets/:assetId/unavailability')
  listAssetUnavailability(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listAssetUnavailability(assetId);
  }

  @Post('assets/:assetId/unavailability')
  createAssetUnavailability(@Param('assetId') assetId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createAssetUnavailability(assetId, body);
  }

  @Get('assets/:assetId/locations')
  listAssetLocations(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listAssetLocations(assetId);
  }

  @Post('assets/:assetId/locations')
  createAssetLocation(@Param('assetId') assetId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createAssetLocation(assetId, body);
  }

  @Get('assets/:assetId/blocks')
  listAssetBlocks(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listAssetBlocks(assetId);
  }

  @Post('assets/:assetId/blocks')
  createAssetBlock(@Param('assetId') assetId: string, @Body() body: unknown): Promise<QualificationRecord> {
    return this.qualification.createAssetBlock(assetId, body);
  }

  @Post('assets/:assetId/blocks/:blockId/release')
  releaseAssetBlock(
    @Param('assetId') assetId: string,
    @Param('blockId') blockId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.releaseAssetBlock(assetId, blockId, body);
  }
}
