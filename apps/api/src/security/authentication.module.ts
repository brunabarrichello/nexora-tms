import { Module } from '@nestjs/common';

import { ExternalIdentityService } from './external-identity.service.js';
import { OidcAuthenticationGuard } from './oidc-authentication.guard.js';
import { OidcConfigService } from './oidc-config.service.js';
import { OidcTokenVerifierService } from './oidc-token-verifier.service.js';

@Module({
  providers: [
    ExternalIdentityService,
    OidcAuthenticationGuard,
    OidcConfigService,
    OidcTokenVerifierService,
  ],
  exports: [OidcAuthenticationGuard],
})
export class AuthenticationModule {}
