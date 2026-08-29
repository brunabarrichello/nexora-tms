import { Module } from '@nestjs/common';

import { ApiController } from './api.controller.js';
import { HealthController } from './health.controller.js';
import { TenancyModule } from './tenancy/tenancy.module.js';

@Module({
  imports: [TenancyModule],
  controllers: [ApiController, HealthController],
})
export class AppModule {}
