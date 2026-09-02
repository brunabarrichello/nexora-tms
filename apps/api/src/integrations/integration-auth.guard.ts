import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { IntegrationAuthService } from './integration-auth.service.js';
import { IntegrationContext } from './integration-context.js';

@Injectable()
export class IntegrationAuthGuard implements CanActivate {
  constructor(
    private readonly authentication: IntegrationAuthService,
    private readonly context: IntegrationContext,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const raw = request.headers?.authorization;
    const authorization = Array.isArray(raw) ? raw[0] : raw;
    const authenticated = await this.authentication.authenticate(authorization);
    this.context.establish(authenticated);
    return true;
  }
}
