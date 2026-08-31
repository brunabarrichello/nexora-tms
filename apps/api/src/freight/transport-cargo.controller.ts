import { Body, Controller, Get, Param, Put } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { TransportCargoService, type TransportCargoProfile } from './transport-cargo.service.js';

@Controller('api/v1/freight/transport-requests/:requestId/cargo-profile')
export class TransportCargoController {
  constructor(private readonly cargo: TransportCargoService) {}

  @Get()
  @TenantAuthorized('freight.read')
  getProfile(@Param('requestId') requestId: string): Promise<TransportCargoProfile | null> {
    return this.cargo.getProfile(requestId);
  }

  @Put()
  @TenantAuthorized('freight.write')
  upsertProfile(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<TransportCargoProfile> {
    return this.cargo.upsertProfile(requestId, body);
  }
}
