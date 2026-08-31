import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { ExternalIdentityService } from './external-identity.service.js';
import { OidcAuthenticationGuard } from './oidc-authentication.guard.js';
import { OidcConfigService } from './oidc-config.service.js';
import { OidcTokenVerifierService } from './oidc-token-verifier.service.js';
import { PretenantAuthAuditService } from './pretenant-auth-audit.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    ExternalIdentityService,
    OidcAuthenticationGuard,
    OidcConfigService,
    OidcTokenVerifierService,
    PretenantAuthAuditService,
  ],
  exports: [OidcAuthenticationGuard],
})
export class AuthenticationModule {}
