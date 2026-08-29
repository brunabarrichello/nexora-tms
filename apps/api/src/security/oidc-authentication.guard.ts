import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthenticatedHttpRequest } from './authenticated-principal.js';
import { ExternalIdentityService } from './external-identity.service.js';
import { OidcTokenVerifierService } from './oidc-token-verifier.service.js';

@Injectable()
export class OidcAuthenticationGuard implements CanActivate {
  constructor(
    private readonly verifier: OidcTokenVerifierService,
    private readonly identities: ExternalIdentityService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext
      .switchToHttp()
      .getRequest<AuthenticatedHttpRequest>();

    const token = this.readBearerToken(request);
    const identity = await this.verifier.verify(token);
    const userId = await this.identities.resolveActiveUser(
      identity.providerKey,
      identity.subject,
    );

    if (!userId) {
      throw new UnauthorizedException(
        'The verified external identity is not linked to an active Nexora user',
      );
    }

    request.authenticatedPrincipal = {
      subject: `${identity.providerKey}|${identity.subject}`,
      userId,
    };

    return true;
  }

  private readBearerToken(request: AuthenticatedHttpRequest): string {
    const header = request.headers.authorization;
    if (!header || Array.isArray(header)) {
      throw new UnauthorizedException('A Bearer access token is required');
    }

    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    const token = match?.[1]?.trim();
    if (!token) {
      throw new UnauthorizedException('A Bearer access token is required');
    }

    return token;
  }
}
