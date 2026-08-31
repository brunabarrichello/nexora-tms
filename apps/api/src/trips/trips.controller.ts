import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { TripsService, type Trip } from './trips.service.js';

@Controller('api/v1/trips')
@TenantAuthorized('trips.read')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Get()
  list(): Promise<readonly Trip[]> {
    return this.trips.list();
  }

  @Post()
  @TenantAuthorized('trips.write')
  create(@Body() body: unknown): Promise<Trip> {
    return this.trips.create(body);
  }

  @Get(':tripId')
  get(@Param('tripId') tripId: string): Promise<Trip> {
    return this.trips.get(tripId);
  }

  @Post(':tripId/status')
  @TenantAuthorized('trips.write')
  setStatus(@Param('tripId') tripId: string, @Body() body: unknown): Promise<Trip> {
    return this.trips.setStatus(tripId, body);
  }

  @Get(':tripId/requests')
  listRequests(@Param('tripId') tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.trips.listRequests(tripId);
  }

  @Post(':tripId/requests/:transportRequestId')
  @TenantAuthorized('trips.write')
  addRequest(
    @Param('tripId') tripId: string,
    @Param('transportRequestId') transportRequestId: string,
    @Body() body: unknown,
  ): Promise<void> {
    return this.trips.addRequest(tripId, transportRequestId, body);
  }

  @Post(':tripId/requests/:transportRequestId/remove')
  @TenantAuthorized('trips.write')
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
  @TenantAuthorized('trips.write')
  addStop(@Param('tripId') tripId: string, @Body() body: unknown): Promise<void> {
    return this.trips.addStop(tripId, body);
  }

  @Get(':tripId/drivers')
  listDrivers(@Param('tripId') tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.trips.listDrivers(tripId);
  }

  @Post(':tripId/drivers')
  @TenantAuthorized('trips.write')
  addDriver(@Param('tripId') tripId: string, @Body() body: unknown): Promise<void> {
    return this.trips.addDriver(tripId, body);
  }

  @Get(':tripId/assets')
  listAssets(@Param('tripId') tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.trips.listAssets(tripId);
  }

  @Post(':tripId/assets')
  @TenantAuthorized('trips.write')
  addAsset(@Param('tripId') tripId: string, @Body() body: unknown): Promise<void> {
    return this.trips.addAsset(tripId, body);
  }

  @Get(':tripId/status-history')
  listStatusHistory(@Param('tripId') tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.trips.listStatusHistory(tripId);
  }
}
