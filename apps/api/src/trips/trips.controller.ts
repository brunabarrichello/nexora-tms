import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TripsService, type Trip } from './trips.service.js';

@Controller('api/v1/trips')
@UseGuards(TenantRuntimeGateGuard)
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Get()
  list(): Promise<readonly Trip[]> {
    return this.trips.list();
  }

  @Post()
  create(@Body() body: unknown): Promise<Trip> {
    return this.trips.create(body);
  }

  @Get(':tripId')
  get(@Param('tripId') tripId: string): Promise<Trip> {
    return this.trips.get(tripId);
  }

  @Post(':tripId/status')
  setStatus(@Param('tripId') tripId: string, @Body() body: unknown): Promise<Trip> {
    return this.trips.setStatus(tripId, body);
  }

  @Get(':tripId/requests')
  listRequests(@Param('tripId') tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.trips.listRequests(tripId);
  }

  @Post(':tripId/requests/:transportRequestId')
  addRequest(
    @Param('tripId') tripId: string,
    @Param('transportRequestId') transportRequestId: string,
    @Body() body: unknown,
  ): Promise<void> {
    return this.trips.addRequest(tripId, transportRequestId, body);
  }

  @Post(':tripId/requests/:transportRequestId/remove')
  removeRequest(
    @Param('tripId') tripId: string,
    @Param('transportRequestId') transportRequestId: string,
    @Body() body: unknown,
  ): Promise<void> {
    return this.trips.removeRequest(tripId, transportRequestId, body);
  }

  @Get(':tripId/stops')
  listStops(@Param('tripId') tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.trips.listStops(tripId);
  }

  @Post(':tripId/stops')
  addStop(@Param('tripId') tripId: string, @Body() body: unknown): Promise<void> {
    return this.trips.addStop(tripId, body);
  }

  @Get(':tripId/drivers')
  listDrivers(@Param('tripId') tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.trips.listDrivers(tripId);
  }

  @Post(':tripId/drivers')
  addDriver(@Param('tripId') tripId: string, @Body() body: unknown): Promise<void> {
    return this.trips.addDriver(tripId, body);
  }

  @Get(':tripId/assets')
  listAssets(@Param('tripId') tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.trips.listAssets(tripId);
  }

  @Post(':tripId/assets')
  addAsset(@Param('tripId') tripId: string, @Body() body: unknown): Promise<void> {
    return this.trips.addAsset(tripId, body);
  }

  @Get(':tripId/status-history')
  listStatusHistory(@Param('tripId') tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.trips.listStatusHistory(tripId);
  }
}
