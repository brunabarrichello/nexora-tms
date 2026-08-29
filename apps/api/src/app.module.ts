import { Module } from '@nestjs/common';

import { ApiController } from './api.controller';
import { HealthController } from './health.controller';

@Module({
  controllers: [ApiController, HealthController],
})
export class AppModule {}
