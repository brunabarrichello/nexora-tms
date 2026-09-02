import { Module } from '@nestjs/common';

import { TenancyModule } from '../tenancy/tenancy.module.js';
import { AsyncAdminController } from './async-admin.controller.js';
import { AsyncAdminService } from './async-admin.service.js';

@Module({
  imports: [TenancyModule],
  controllers: [AsyncAdminController],
  providers: [AsyncAdminService],
})
export class ReliabilityModule {}
