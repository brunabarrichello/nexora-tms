import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import {
  TransportContractService,
  type TransportContract,
} from './transport-contract.service.js';

@Controller('api/v1/negotiation')
@UseGuards(TenantRuntimeGateGuard)
export class TransportContractController {
  constructor(private readonly contracts: TransportContractService) {}

  @Get('requests/:requestId/contracts')
  list(@Param('requestId') requestId: string): Promise<readonly TransportContract[]> {
    return this.contracts.list(requestId);
  }

  @Post('reservations/:reservationId/contracts/confirm')
  confirm(@Param('reservationId') reservationId: string): Promise<TransportContract> {
    return this.contracts.confirm(reservationId);
  }

  @Post('reservations/:reservationId/contracts/refuse')
  refuse(
    @Param('reservationId') reservationId: string,
    @Body() body: unknown,
  ): Promise<TransportContract> {
    return this.contracts.refuse(reservationId, body);
  }

  @Post('contracts/:contractId/cancel')
  cancel(
    @Param('contractId') contractId: string,
    @Body() body: unknown,
  ): Promise<TransportContract> {
    return this.contracts.cancel(contractId, body);
  }
}
