import { ForbiddenException, Injectable } from '@nestjs/common';

import { TenantContext } from './tenant-context.js';
import { isUuid } from './tenant-id.js';

@Injectable()
export class TenantAuthorizationService {
  constructor(private readonly tenantContext: TenantContext) {}

  assertResourceTenant(resourceTenantId: string): void {
    const active = this.tenantContext.require();

    if (!isUuid(resourceTenantId) || resourceTenantId !== active.tenantId) {
      throw new ForbiddenException('The requested resource is outside the active tenant boundary');
    }
  }
}
