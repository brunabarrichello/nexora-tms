import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  CapacityAssignmentService,
  type CapacityComposition,
} from './capacity-assignment.service.js';

@Controller('api/v1/capacity/assignments')
@TenantAuthorized('capacity.read')
export class CapacityAssignmentController {
  constructor(private readonly assignments: CapacityAssignmentService) {}

  @Get('active')
  active(): Promise<readonly CapacityComposition[]> {
    return this.assignments.active();
  }

  @Get('history')
  history(): Promise<readonly CapacityComposition[]> {
    return this.assignments.history();
  }

  @Post()
  @TenantAuthorized('capacity.write')
  create(@Body() body: unknown): Promise<CapacityComposition> {
    return this.assignments.create(body);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<CapacityComposition> {
    return this.assignments.getById(id);
  }

  @Patch(':id/close')
  @TenantAuthorized('capacity.write')
  close(@Param('id') id: string, @Body() body: unknown): Promise<CapacityComposition> {
    return this.assignments.close(id, body);
  }
}
