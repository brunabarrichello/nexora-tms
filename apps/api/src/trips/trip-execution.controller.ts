import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { TripExecutionService } from './trip-execution.service.js';

@Controller('api/v1/trips')
@TenantAuthorized('trips.read')
export class TripExecutionController {
  constructor(private readonly execution: TripExecutionService) {}

  @Get(':tripId/events')
  listEvents(@Param('tripId') tripId: string) {
    return this.execution.listEvents(tripId);
  }
  @Post(':tripId/events')
  @TenantAuthorized('trips.write')
  createEvent(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createEvent(tripId, body);
  }

  @Get(':tripId/checkins')
  listCheckins(@Param('tripId') tripId: string) {
    return this.execution.listCheckins(tripId);
  }
  @Post(':tripId/checkins')
  @TenantAuthorized('trips.write')
  createCheckin(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createCheckin(tripId, body);
  }

  @Get(':tripId/locations')
  listLocations(@Param('tripId') tripId: string) {
    return this.execution.listLocations(tripId);
  }
  @Post(':tripId/locations')
  @TenantAuthorized('trips.write')
  createLocation(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createLocation(tripId, body);
  }

  @Get(':tripId/checklists')
  listChecklists(@Param('tripId') tripId: string) {
    return this.execution.listChecklists(tripId);
  }
  @Post(':tripId/checklists')
  @TenantAuthorized('trips.write')
  createChecklist(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createChecklist(tripId, body);
  }
  @Post(':tripId/checklists/:checklistId/status')
  @TenantAuthorized('trips.write')
  setChecklistStatus(
    @Param('tripId') tripId: string,
    @Param('checklistId') checklistId: string,
    @Body() body: unknown,
  ) {
    return this.execution.setChecklistStatus(tripId, checklistId, body);
  }

  @Get(':tripId/documents')
  listDocuments(@Param('tripId') tripId: string) {
    return this.execution.listDocuments(tripId);
  }
  @Post(':tripId/documents')
  @TenantAuthorized('trips.write')
  linkDocument(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.linkDocument(tripId, body);
  }

  @Get(':tripId/expenses')
  listExpenses(@Param('tripId') tripId: string) {
    return this.execution.listExpenses(tripId);
  }
  @Post(':tripId/expenses')
  @TenantAuthorized('trips.write')
  createExpense(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createExpense(tripId, body);
  }
  @Post(':tripId/expenses/:expenseId/status')
  @TenantAuthorized('trips.write')
  setExpenseStatus(
    @Param('tripId') tripId: string,
    @Param('expenseId') expenseId: string,
    @Body() body: unknown,
  ) {
    return this.execution.setExpenseStatus(tripId, expenseId, body);
  }

  @Get(':tripId/tolls')
  listTolls(@Param('tripId') tripId: string) {
    return this.execution.listTolls(tripId);
  }
  @Post(':tripId/tolls')
  @TenantAuthorized('trips.write')
  createToll(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createToll(tripId, body);
  }

  @Get(':tripId/fuel')
  listFuel(@Param('tripId') tripId: string) {
    return this.execution.listFuel(tripId);
  }
  @Post(':tripId/fuel')
  @TenantAuthorized('trips.write')
  createFuel(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createFuel(tripId, body);
  }

  @Get(':tripId/proofs')
  listProofs(@Param('tripId') tripId: string) {
    return this.execution.listProofs(tripId);
  }
  @Post(':tripId/proofs')
  @TenantAuthorized('trips.write')
  createProof(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createProof(tripId, body);
  }

  @Get(':tripId/delivery-proofs')
  listDeliveryProofs(@Param('tripId') tripId: string) {
    return this.execution.listDeliveryProofs(tripId);
  }
  @Post(':tripId/delivery-proofs')
  @TenantAuthorized('trips.write')
  createDeliveryProof(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createDeliveryProof(tripId, body);
  }
}
