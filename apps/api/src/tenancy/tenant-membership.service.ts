import { Injectable } from '@nestjs/common';

import { TenantDatabaseService } from './tenant-database.service.js';

@Injectable()
export class TenantMembershipService {
  constructor(private readonly database: TenantDatabaseService) {}

  async isActiveMember(userId: string, tenantId: string): Promise<boolean> {
    return this.database.withUserDiscoveryContext(userId, async (client) => {
      const result = await client.query<{ membership_id: string }>(
        `SELECT id::text AS membership_id
           FROM memberships
          WHERE tenant_id = $1::uuid
            AND user_id = $2::uuid
            AND status = 'active'
          LIMIT 1`,
        [tenantId, userId],
      );

      return result.rowCount === 1;
    });
  }
}
