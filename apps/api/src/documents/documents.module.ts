import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { DOCUMENT_STORAGE_PORT } from './document-storage.port.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { UnconfiguredDocumentStorageAdapter } from './unconfigured-document-storage.adapter.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    TenantRuntimeGateGuard,
    UnconfiguredDocumentStorageAdapter,
    {
      provide: DOCUMENT_STORAGE_PORT,
      useExisting: UnconfiguredDocumentStorageAdapter,
    },
  ],
  exports: [DocumentsService, DOCUMENT_STORAGE_PORT],
})
export class DocumentsModule {}
