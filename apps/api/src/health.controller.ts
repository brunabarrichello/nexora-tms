import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { TenantDatabaseService } from './tenancy/tenant-database.service.js';

export interface HealthResponse {
  status: 'ok';
  service: 'nexora-tms-api';
  timestamp: string;
}

export interface ReadinessResponse extends HealthResponse {
  database: 'ok';
}

@Controller('health')
export class HealthController {
  constructor(private readonly database: TenantDatabaseService) {}

  @Get()
  getHealth(): HealthResponse {
    return this.getLiveness();
  }

  @Get('live')
  getLiveness(): HealthResponse {
    return {
      status: 'ok',
      service: 'nexora-tms-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async getReadiness(): Promise<ReadinessResponse> {
    try {
      await this.database.checkReadiness();
    } catch {
      throw new ServiceUnavailableException('database readiness check failed');
    }

    return {
      ...this.getLiveness(),
      database: 'ok',
    };
  }
}
