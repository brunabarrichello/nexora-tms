import { Controller, Get, Param, Query } from '@nestjs/common';

import { ExternalAuthorized } from './external-authorized.decorator.js';
import { ExternalApiService } from './external-api.service.js';

@Controller('api/external/v1')
export class ExternalApiController {
  constructor(private readonly api: ExternalApiService) {}

  @Get('transport-requests')
  @ExternalAuthorized('freight.read')
  listTransportRequests(@Query('limit') limit?: string) {
    return this.api.listTransportRequests(limit);
  }

  @Get('transport-requests/:transportRequestId')
  @ExternalAuthorized('freight.read')
  getTransportRequest(@Param('transportRequestId') transportRequestId: string) {
    return this.api.getTransportRequest(transportRequestId);
  }

  @Get('trips')
  @ExternalAuthorized('trips.read')
  listTrips(@Query('limit') limit?: string) {
    return this.api.listTrips(limit);
  }

  @Get('trips/:tripId')
  @ExternalAuthorized('trips.read')
  getTrip(@Param('tripId') tripId: string) {
    return this.api.getTrip(tripId);
  }

  @Get('documents')
  @ExternalAuthorized('documents.read')
  listDocuments(@Query('limit') limit?: string) {
    return this.api.listDocuments(limit);
  }

  @Get('documents/:documentId')
  @ExternalAuthorized('documents.read')
  getDocument(@Param('documentId') documentId: string) {
    return this.api.getDocument(documentId);
  }
}
