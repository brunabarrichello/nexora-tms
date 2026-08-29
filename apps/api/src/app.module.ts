import { Module } from '@nestjs/common';

import { ApiController } from './api.controller.js';
import { HealthController } from './health.controller.js';
import { AuthController } from './security/auth.controller.js';
import { AuthenticationModule } from './security/authentication.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [ApiController, HealthController, AuthController],
})
export class AppModule {}
