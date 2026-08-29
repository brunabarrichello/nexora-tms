import { Controller, Get } from '@nestjs/common';

@Controller('api/v1')
export class ApiController {
  @Get()
  getApiMetadata(): { service: string; version: string; status: string } {
    return {
      service: 'nexora-tms-api',
      version: '0.1.0',
      status: 'ok',
    };
  }
}
