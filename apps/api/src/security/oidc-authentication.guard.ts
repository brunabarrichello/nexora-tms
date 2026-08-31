import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import type { AuthenticatedHttpRequest } from './authenticated-principal.js';
import { ExternalIdentityService } from './external-identity.service.js';
import { OidcTokenVerifierService } from './oidc-token-verifier.service.js';
import { PretenantAuthAuditService } from './pretenant-auth-audit.service.js';

@Injectable()
export class OidcAuthenticationGuard implements CanActivate {
  constructor(
    private readonly verifier: OidcTokenVerifierService,
    private readonly identities: ExternalIdentityService,
    private readonly audit: PretenantAuthAuditService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    const context = this.auditContext(request);

    let token: string;
    try {
      token = this.readBearerToken(request);
    } catch (error) {
      await this.audit.record({
        eventType: 'auth.bearer.missing',
        outcome: 'denied',
        ...context,
      });
      throw error;
    }

    let identity: Awaited<ReturnType<OidcTokenVerifierService['verify']>>;
    try {
      identity = await this.verifier.verify(token);
    } catch (error) {
      await this.audit.record({
        eventType: 'auth.bearer.rejected',
        outcome: 'denied',
        ...context,
      });
      throw error;
    }

    const userId = await this.identities.resolveActiveUser(identity.providerKey, identity.subject);

    if (!userId) {
      await this.audit.record({
        eventType: 'auth.identity.unlinked',
        outcome: 'denied',
        providerKey: identity.providerKey,
        subject: identity.subject,
        ...context,
      });
      throw new UnauthorizedException(
        'The verified external identity is not linked to an active Nexora user',
      );
    }

    request.authenticatedPrincipal = {
      subject: `${identity.providerKey}|${identity.subject}`,
      userId,
    };

    await this.audit.record({
      eventType: 'auth.identity.accepted',
      outcome: 'success',
      providerKey: identity.providerKey,
      subject: identity.subject,
      userId,
      ...context,
    });

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

  private auditContext(request: AuthenticatedHttpRequest): {
    requestId?: string;
    correlationId?: string;
  } {
    return {
      requestId: this.readSingleHeader(request, 'x-request-id'),
      correlationId: this.readSingleHeader(request, 'x-correlation-id'),
    };
  }

  private readSingleHeader(request: AuthenticatedHttpRequest, name: string): string | undefined {
    const value = request.headers[name];
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : undefined;
  }
}
