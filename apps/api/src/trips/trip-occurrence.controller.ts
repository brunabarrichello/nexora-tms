import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { TripOccurrenceService } from './trip-occurrence.service.js';

@Controller('api/v1/trips')
@TenantAuthorized('trips.read')
export class TripOccurrenceController {
  constructor(private readonly occurrences: TripOccurrenceService) {}

  @Get(':tripId/occurrences')
  list(@Param('tripId') tripId: string) {
    return this.occurrences.list(tripId);
  }

  @Post(':tripId/occurrences')
  @TenantAuthorized('trips.write')
  create(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.occurrences.create(tripId, body);
  }

  @Get(':tripId/occurrences/:occurrenceId')
  get(@Param('tripId') tripId: string, @Param('occurrenceId') occurrenceId: string) {
    return this.occurrences.get(tripId, occurrenceId);
  }

  @Get(':tripId/occurrences/:occurrenceId/history')
  listHistory(@Param('tripId') tripId: string, @Param('occurrenceId') occurrenceId: string) {
    return this.occurrences.listHistory(tripId, occurrenceId);
  }

  @Post(':tripId/occurrences/:occurrenceId/treatments')
  @TenantAuthorized('trips.write')
  addTreatment(
    @Param('tripId') tripId: string,
    @Param('occurrenceId') occurrenceId: string,
    @Body() body: unknown,
  ) {
    return this.occurrences.addTreatment(tripId, occurrenceId, body);
  }

  @Post(':tripId/occurrences/:occurrenceId/status')
  @TenantAuthorized('trips.write')
  setStatus(
    @Param('tripId') tripId: string,
    @Param('occurrenceId') occurrenceId: string,
    @Body() body: unknown,
  ) {
    return this.occurrences.setStatus(tripId, occurrenceId, body);
  }

  @Get(':tripId/occurrences/:occurrenceId/documents')
  listDocuments(@Param('tripId') tripId: string, @Param('occurrenceId') occurrenceId: string) {
    return this.occurrences.listDocuments(tripId, occurrenceId);
  }

  @Post(':tripId/occurrences/:occurrenceId/documents')
  @TenantAuthorized('trips.write')
  linkDocument(
    @Param('tripId') tripId: string,
    @Param('occurrenceId') occurrenceId: string,
    @Body() body: unknown,
  ) {
    return this.occurrences.linkDocument(tripId, occurrenceId, body);
  }
}
