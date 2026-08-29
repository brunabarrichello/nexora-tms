import { Module } from '@nestjs/common';

import { ApiController } from './api.controller.js';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [ApiController, HealthController],
})
export class AppModule {}
