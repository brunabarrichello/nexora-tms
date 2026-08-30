import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TripExecutionService } from './trip-execution.service.js';

@Controller('api/v1/trips')
@UseGuards(TenantRuntimeGateGuard)
export class TripExecutionController {
  constructor(private readonly execution: TripExecutionService) {}

  @Get(':tripId/events')
  listEvents(@Param('tripId') tripId: string) {
    return this.execution.listEvents(tripId);
  }
  @Post(':tripId/events')
  createEvent(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createEvent(tripId, body);
  }

  @Get(':tripId/checkins')
  listCheckins(@Param('tripId') tripId: string) {
    return this.execution.listCheckins(tripId);
  }
  @Post(':tripId/checkins')
  createCheckin(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createCheckin(tripId, body);
  }

  @Get(':tripId/locations')
  listLocations(@Param('tripId') tripId: string) {
    return this.execution.listLocations(tripId);
  }
  @Post(':tripId/locations')
  createLocation(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createLocation(tripId, body);
  }

  @Get(':tripId/checklists')
  listChecklists(@Param('tripId') tripId: string) {
    return this.execution.listChecklists(tripId);
  }
  @Post(':tripId/checklists')
  createChecklist(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createChecklist(tripId, body);
  }
  @Post(':tripId/checklists/:checklistId/status')
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
  linkDocument(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.linkDocument(tripId, body);
  }

  @Get(':tripId/expenses')
  listExpenses(@Param('tripId') tripId: string) {
    return this.execution.listExpenses(tripId);
  }
  @Post(':tripId/expenses')
  createExpense(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createExpense(tripId, body);
  }
  @Post(':tripId/expenses/:expenseId/status')
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
  createToll(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createToll(tripId, body);
  }

  @Get(':tripId/fuel')
  listFuel(@Param('tripId') tripId: string) {
    return this.execution.listFuel(tripId);
  }
  @Post(':tripId/fuel')
  createFuel(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createFuel(tripId, body);
  }

  @Get(':tripId/proofs')
  listProofs(@Param('tripId') tripId: string) {
    return this.execution.listProofs(tripId);
  }
  @Post(':tripId/proofs')
  createProof(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createProof(tripId, body);
  }

  @Get(':tripId/delivery-proofs')
  listDeliveryProofs(@Param('tripId') tripId: string) {
    return this.execution.listDeliveryProofs(tripId);
  }
  @Post(':tripId/delivery-proofs')
  createDeliveryProof(@Param('tripId') tripId: string, @Body() body: unknown) {
    return this.execution.createDeliveryProof(tripId, body);
  }
}
