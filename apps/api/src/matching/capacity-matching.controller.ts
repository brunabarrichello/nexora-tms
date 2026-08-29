import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import {
  CapacityMatchingService,
  type CapacityMatchingResult,
} from './capacity-matching.service.js';

@Controller('api/v1/matching/requests')
@UseGuards(TenantRuntimeGateGuard)
export class CapacityMatchingController {
  constructor(private readonly matching: CapacityMatchingService) {}

  @Get(':requestId/capacity')
  search(@Param('requestId') requestId: string): Promise<CapacityMatchingResult> {
    return this.matching.search(requestId);
  }
}
