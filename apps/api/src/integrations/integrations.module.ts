import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { ExternalApiController } from './external-api.controller.js';
import { ExternalApiService } from './external-api.service.js';
import { IntegrationAuthGuard } from './integration-auth.guard.js';
import { IntegrationAuthService } from './integration-auth.service.js';
import { IntegrationContext } from './integration-context.js';
import { IntegrationScopeGuard } from './integration-scope.guard.js';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [IntegrationsController, ExternalApiController],
  providers: [
    IntegrationsService,
    ExternalApiService,
    IntegrationContext,
    IntegrationAuthService,
    IntegrationAuthGuard,
    IntegrationScopeGuard,
    TenantRuntimeGateGuard,
  ],
})
export class IntegrationsModule {}
