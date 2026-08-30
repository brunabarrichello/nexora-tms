import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import {
  CapacityReservationService,
  type CapacityReservation,
} from './capacity-reservation.service.js';

@Controller('api/v1/negotiation')
@UseGuards(TenantRuntimeGateGuard)
export class CapacityReservationController {
  constructor(private readonly reservations: CapacityReservationService) {}

  @Get('requests/:requestId/reservations')
  list(@Param('requestId') requestId: string): Promise<readonly CapacityReservation[]> {
    return this.reservations.list(requestId);
  }

  @Post('proposals/:proposalId/reservations')
  approve(@Param('proposalId') proposalId: string): Promise<CapacityReservation> {
    return this.reservations.approve(proposalId);
  }

  @Post('reservations/:reservationId/cancel')
  cancel(
    @Param('reservationId') reservationId: string,
    @Body() body: unknown,
  ): Promise<CapacityReservation> {
    return this.reservations.cancel(reservationId, body);
  }
}
