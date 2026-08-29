import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { DriverService, type Driver, type DriverAuditEntry } from './driver.service.js';

@Controller('api/v1/capacity/drivers')
@UseGuards(TenantRuntimeGateGuard)
export class DriverController {
  constructor(private readonly drivers: DriverService) {}

  @Get()
  list(): Promise<readonly Driver[]> {
    return this.drivers.list();
  }

  @Post()
  create(@Body() body: unknown): Promise<Driver> {
    return this.drivers.create(body);
  }

  @Get(':id/audit')
  audit(@Param('id') id: string): Promise<readonly DriverAuditEntry[]> {
    return this.drivers.audit(id);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<Driver> {
    return this.drivers.getById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown): Promise<Driver> {
    return this.drivers.update(id, body);
  }
}
