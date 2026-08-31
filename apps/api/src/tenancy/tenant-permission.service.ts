import { Injectable } from '@nestjs/common';

import type { TenantPermissionKey } from './rbac-catalog.js';
import { TenantContext } from './tenant-context.js';
import { TenantDatabaseService } from './tenant-database.service.js';

@Injectable()
export class TenantPermissionService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async hasPermission(permissionKey: TenantPermissionKey): Promise<boolean> {
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<{ allowed: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM memberships m
             JOIN membership_roles mr
               ON mr.tenant_id = m.tenant_id
              AND mr.membership_id = m.id
             JOIN role_permissions rp
               ON rp.tenant_id = mr.tenant_id
              AND rp.role_id = mr.role_id
             JOIN permissions p
               ON p.id = rp.permission_id
            WHERE m.tenant_id = $1::uuid
              AND m.user_id = $2::uuid
              AND m.status = 'active'
              AND p.key = $3
         ) AS allowed`,
        [context.tenantId, context.userId, permissionKey],
      );

      return result.rows[0]?.allowed === true;
    });
  }
}
