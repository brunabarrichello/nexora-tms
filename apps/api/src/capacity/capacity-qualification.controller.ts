import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  CapacityQualificationService,
  type QualificationRecord,
} from './capacity-qualification.service.js';

@Controller('api/v1/capacity')
@TenantAuthorized('capacity.read')
export class CapacityQualificationController {
  constructor(private readonly qualification: CapacityQualificationService) {}

  @Get('drivers/:driverId/documents')
  listDriverDocuments(
    @Param('driverId') driverId: string,
  ): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverDocuments(driverId);
  }

  @Post('drivers/:driverId/documents')
  @TenantAuthorized('capacity.write')
  createDriverDocument(
    @Param('driverId') driverId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createDriverDocument(driverId, body);
  }

  @Get('drivers/:driverId/qualifications')
  listDriverQualifications(
    @Param('driverId') driverId: string,
  ): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverQualifications(driverId);
  }

  @Post('drivers/:driverId/qualifications')
  @TenantAuthorized('capacity.write')
  createDriverQualification(
    @Param('driverId') driverId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createDriverQualification(driverId, body);
  }

  @Get('drivers/:driverId/courses')
  listDriverCourses(@Param('driverId') driverId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverCourses(driverId);
  }

  @Post('drivers/:driverId/courses')
  @TenantAuthorized('capacity.write')
  createDriverCourse(
    @Param('driverId') driverId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createDriverCourse(driverId, body);
  }

  @Get('drivers/:driverId/availability')
  getDriverAvailability(@Param('driverId') driverId: string): Promise<QualificationRecord> {
    return this.qualification.getDriverAvailability(driverId);
  }

  @Put('drivers/:driverId/availability')
  @TenantAuthorized('capacity.write')
  setDriverAvailability(
    @Param('driverId') driverId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.setDriverAvailability(driverId, body);
  }

  @Get('drivers/:driverId/unavailability')
  listDriverUnavailability(
    @Param('driverId') driverId: string,
  ): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverUnavailability(driverId);
  }

  @Post('drivers/:driverId/unavailability')
  @TenantAuthorized('capacity.write')
  createDriverUnavailability(
    @Param('driverId') driverId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createDriverUnavailability(driverId, body);
  }

  @Get('drivers/:driverId/emergency-contacts')
  listDriverEmergencyContacts(
    @Param('driverId') driverId: string,
  ): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverEmergencyContacts(driverId);
  }

  @Post('drivers/:driverId/emergency-contacts')
  @TenantAuthorized('capacity.write')
  createDriverEmergencyContact(
    @Param('driverId') driverId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createDriverEmergencyContact(driverId, body);
  }

  @Get('drivers/:driverId/blocks')
  listDriverBlocks(@Param('driverId') driverId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listDriverBlocks(driverId);
  }

  @Post('drivers/:driverId/blocks')
  @TenantAuthorized('capacity.write')
  createDriverBlock(
    @Param('driverId') driverId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createDriverBlock(driverId, body);
  }

  @Post('drivers/:driverId/blocks/:blockId/release')
  @TenantAuthorized('capacity.write')
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
  @TenantAuthorized('capacity.write')
  createDriverRating(
    @Param('driverId') driverId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createDriverRating(driverId, body);
  }

  @Get('assets/:assetId/capabilities')
  getAssetCapabilities(@Param('assetId') assetId: string): Promise<QualificationRecord> {
    return this.qualification.getAssetCapabilities(assetId);
  }

  @Put('assets/:assetId/capabilities')
  @TenantAuthorized('capacity.write')
  setAssetCapabilities(
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.setAssetCapabilities(assetId, body);
  }

  @Get('assets/:assetId/documents')
  listAssetDocuments(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listAssetDocuments(assetId);
  }

  @Post('assets/:assetId/documents')
  @TenantAuthorized('capacity.write')
  createAssetDocument(
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createAssetDocument(assetId, body);
  }

  @Get('assets/:assetId/maintenance-plans')
  listMaintenancePlans(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listMaintenancePlans(assetId);
  }

  @Post('assets/:assetId/maintenance-plans')
  @TenantAuthorized('capacity.write')
  createMaintenancePlan(
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createMaintenancePlan(assetId, body);
  }

  @Get('assets/:assetId/maintenance')
  listMaintenance(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listMaintenance(assetId);
  }

  @Post('assets/:assetId/maintenance')
  @TenantAuthorized('capacity.write')
  createMaintenance(
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
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
  @TenantAuthorized('capacity.write')
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
  @TenantAuthorized('capacity.write')
  createInsurance(
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createInsurance(assetId, body);
  }

  @Get('assets/:assetId/inspections')
  listInspections(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listInspections(assetId);
  }

  @Post('assets/:assetId/inspections')
  @TenantAuthorized('capacity.write')
  createInspection(
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createInspection(assetId, body);
  }

  @Get('assets/:assetId/availability')
  getAssetAvailability(@Param('assetId') assetId: string): Promise<QualificationRecord> {
    return this.qualification.getAssetAvailability(assetId);
  }

  @Put('assets/:assetId/availability')
  @TenantAuthorized('capacity.write')
  setAssetAvailability(
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.setAssetAvailability(assetId, body);
  }

  @Get('assets/:assetId/unavailability')
  listAssetUnavailability(
    @Param('assetId') assetId: string,
  ): Promise<readonly QualificationRecord[]> {
    return this.qualification.listAssetUnavailability(assetId);
  }

  @Post('assets/:assetId/unavailability')
  @TenantAuthorized('capacity.write')
  createAssetUnavailability(
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createAssetUnavailability(assetId, body);
  }

  @Get('assets/:assetId/locations')
  listAssetLocations(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listAssetLocations(assetId);
  }

  @Post('assets/:assetId/locations')
  @TenantAuthorized('capacity.write')
  createAssetLocation(
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createAssetLocation(assetId, body);
  }

  @Get('assets/:assetId/blocks')
  listAssetBlocks(@Param('assetId') assetId: string): Promise<readonly QualificationRecord[]> {
    return this.qualification.listAssetBlocks(assetId);
  }

  @Post('assets/:assetId/blocks')
  @TenantAuthorized('capacity.write')
  createAssetBlock(
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.createAssetBlock(assetId, body);
  }

  @Post('assets/:assetId/blocks/:blockId/release')
  @TenantAuthorized('capacity.write')
  releaseAssetBlock(
    @Param('assetId') assetId: string,
    @Param('blockId') blockId: string,
    @Body() body: unknown,
  ): Promise<QualificationRecord> {
    return this.qualification.releaseAssetBlock(assetId, blockId, body);
  }
}
