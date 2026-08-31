import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  CapacityReservationService,
  type CapacityReservation,
} from './capacity-reservation.service.js';

@Controller('api/v1/negotiation')
@TenantAuthorized('negotiation.read')
export class CapacityReservationController {
  constructor(private readonly reservations: CapacityReservationService) {}

  @Get('requests/:requestId/reservations')
  list(@Param('requestId') requestId: string): Promise<readonly CapacityReservation[]> {
    return this.reservations.list(requestId);
  }

  @Post('proposals/:proposalId/reservations')
  @TenantAuthorized('negotiation.write')
  approve(@Param('proposalId') proposalId: string): Promise<CapacityReservation> {
    return this.reservations.approve(proposalId);
  }

  @Post('reservations/:reservationId/cancel')
  @TenantAuthorized('negotiation.write')
  cancel(
    @Param('reservationId') reservationId: string,
    @Body() body: unknown,
  ): Promise<CapacityReservation> {
    return this.reservations.cancel(reservationId, body);
  }
}
