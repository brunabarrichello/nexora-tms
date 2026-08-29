import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { OidcAuthenticationGuard } from './security/oidc-authentication.guard.js';
import { TenantContextGuard } from './tenancy/tenant-context.guard.js';

@Injectable()
export class TenantRuntimeGateGuard implements CanActivate {
  constructor(
    private readonly authentication: OidcAuthenticationGuard,
    private readonly tenancy: TenantContextGuard,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const authenticated = await this.authentication.canActivate(executionContext);
    if (!authenticated) {
      return false;
    }

    return this.tenancy.canActivate(executionContext);
  }
}
