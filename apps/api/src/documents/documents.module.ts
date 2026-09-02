import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { ComplianceRiskController } from './compliance-risk.controller.js';
import { COMPLIANCE_RISK_PROVIDER_PORT } from './compliance-risk-provider.port.js';
import { ComplianceRiskService } from './compliance-risk.service.js';
import { DocumentComplianceController } from './document-compliance.controller.js';
import { DocumentComplianceService } from './document-compliance.service.js';
import { DOCUMENT_STORAGE_PORT } from './document-storage.port.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { UnconfiguredComplianceRiskProviderAdapter } from './unconfigured-compliance-risk-provider.adapter.js';
import { UnconfiguredDocumentStorageAdapter } from './unconfigured-document-storage.adapter.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [DocumentsController, DocumentComplianceController, ComplianceRiskController],
  providers: [
    DocumentsService,
    DocumentComplianceService,
    ComplianceRiskService,
    TenantRuntimeGateGuard,
    UnconfiguredDocumentStorageAdapter,
    UnconfiguredComplianceRiskProviderAdapter,
    {
      provide: DOCUMENT_STORAGE_PORT,
      useExisting: UnconfiguredDocumentStorageAdapter,
    },
    {
      provide: COMPLIANCE_RISK_PROVIDER_PORT,
      useExisting: UnconfiguredComplianceRiskProviderAdapter,
    },
  ],
  exports: [
    DocumentsService,
    DocumentComplianceService,
    ComplianceRiskService,
    DOCUMENT_STORAGE_PORT,
    COMPLIANCE_RISK_PROVIDER_PORT,
  ],
})
export class DocumentsModule {}
