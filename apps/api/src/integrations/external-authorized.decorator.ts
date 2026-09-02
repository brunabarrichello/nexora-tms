import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';

import { IntegrationAuthGuard } from './integration-auth.guard.js';
import {
  IntegrationScopeGuard,
  REQUIRED_INTEGRATION_SCOPES,
} from './integration-scope.guard.js';

export const ExternalAuthorized = (...scopes: readonly string[]) =>
  applyDecorators(
    SetMetadata(REQUIRED_INTEGRATION_SCOPES, scopes),
    UseGuards(IntegrationAuthGuard, IntegrationScopeGuard),
  );
