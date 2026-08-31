import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { TenantPermissionService } from './tenant-permission.service.js';

export const REQUIRED_TENANT_PERMISSION = 'nexora:required-tenant-permission';

@Injectable()
export class TenantPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: TenantPermissionService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const permissionKey = this.reflector.getAllAndOverride<string>(REQUIRED_TENANT_PERMISSION, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);

    if (!permissionKey) {
      throw new ForbiddenException('An explicit tenant permission is required for this operation');
    }

    if (!(await this.permissions.hasPermission(permissionKey))) {
      throw new ForbiddenException('The authenticated membership lacks the required permission');
    }

    return true;
  }
}
