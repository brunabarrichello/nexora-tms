import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TransportRouteService, type TransportRoute } from './transport-route.service.js';

@Controller('api/v1/freight/transport-requests/:requestId/route')
@UseGuards(TenantRuntimeGateGuard)
export class TransportRouteController {
  constructor(private readonly routes: TransportRouteService) {}

  @Get()
  getRoute(@Param('requestId') requestId: string): Promise<TransportRoute> {
    return this.routes.getRoute(requestId);
  }

  @Put()
  replaceRoute(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<TransportRoute> {
    return this.routes.replaceRoute(requestId, body);
  }
}
