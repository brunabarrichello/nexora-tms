import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import {
  TransportRequestService,
  type TransportRequest,
} from './transport-request.service.js';

@Controller('api/v1/freight/transport-requests')
@UseGuards(TenantRuntimeGateGuard)
export class TransportRequestController {
  constructor(private readonly transportRequests: TransportRequestService) {}

  @Get()
  list(): Promise<readonly TransportRequest[]> {
    return this.transportRequests.list();
  }

  @Post()
  create(@Body() body: unknown): Promise<TransportRequest> {
    return this.transportRequests.create(body);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<TransportRequest> {
    return this.transportRequests.getById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown): Promise<TransportRequest> {
    return this.transportRequests.update(id, body);
  }
}
