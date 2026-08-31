import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { TransportContractService, type TransportContract } from './transport-contract.service.js';

@Controller('api/v1/negotiation')
@TenantAuthorized('negotiation.read')
export class TransportContractController {
  constructor(private readonly contracts: TransportContractService) {}

  @Get('requests/:requestId/contracts')
  list(@Param('requestId') requestId: string): Promise<readonly TransportContract[]> {
    return this.contracts.list(requestId);
  }

  @Post('reservations/:reservationId/contracts/confirm')
  @TenantAuthorized('negotiation.write')
  confirm(@Param('reservationId') reservationId: string): Promise<TransportContract> {
    return this.contracts.confirm(reservationId);
  }

  @Post('reservations/:reservationId/contracts/refuse')
  @TenantAuthorized('negotiation.write')
  refuse(
    @Param('reservationId') reservationId: string,
    @Body() body: unknown,
  ): Promise<TransportContract> {
    return this.contracts.refuse(reservationId, body);
  }

  @Post('contracts/:contractId/cancel')
  @TenantAuthorized('negotiation.write')
  cancel(
    @Param('contractId') contractId: string,
    @Body() body: unknown,
  ): Promise<TransportContract> {
    return this.contracts.cancel(contractId, body);
  }
}
