import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IntegrationContext } from './integration-context.js';

export const REQUIRED_INTEGRATION_SCOPES = 'nexora.required-integration-scopes';

@Injectable()
export class IntegrationScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly context: IntegrationContext,
  ) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly string[]>(REQUIRED_INTEGRATION_SCOPES, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);
    if (!required || required.length === 0) {
      throw new ForbiddenException('External API scope metadata is required');
    }
    const granted = new Set(this.context.require().scopes);
    const missing = required.filter((scope) => !granted.has(scope));
    if (missing.length > 0) {
      throw new ForbiddenException('Integration credential does not grant the required scope');
    }
    return true;
  }
}
