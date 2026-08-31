import { Body, Controller, Get, Param, Put } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { TransportRouteService, type TransportRoute } from './transport-route.service.js';

@Controller('api/v1/freight/transport-requests/:requestId/route')
export class TransportRouteController {
  constructor(private readonly routes: TransportRouteService) {}

  @Get()
  @TenantAuthorized('freight.read')
  getRoute(@Param('requestId') requestId: string): Promise<TransportRoute> {
    return this.routes.getRoute(requestId);
  }

  @Put()
  @TenantAuthorized('freight.write')
  replaceRoute(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<TransportRoute> {
    return this.routes.replaceRoute(requestId, body);
  }
}
