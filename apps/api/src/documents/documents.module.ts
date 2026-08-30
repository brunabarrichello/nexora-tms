import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, TenantRuntimeGateGuard],
  exports: [DocumentsService],
})
export class DocumentsModule {}
