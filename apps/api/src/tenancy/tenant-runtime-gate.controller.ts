import {
  Controller,
  Get,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenantContext } from './tenant-context.js';
import { TenantDatabaseService } from './tenant-database.service.js';

interface VisibleTenant {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: string;
}

@Controller('api/v1/tenant')
@UseGuards(TenantRuntimeGateGuard)
export class TenantRuntimeGateController {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  @Get('runtime-gate')
  async getRuntimeGate(): Promise<{
    authenticated: true;
    rlsIsolated: true;
    tenantId: string;
    visibleTenant: VisibleTenant;
  }> {
    const context = this.tenantContext.require();
    const visibleTenants = await this.database.withTenantContext(
      context,
      async (client) => {
        const result = await client.query<VisibleTenant>(
          `SELECT id::text AS id, slug, name, status::text AS status
             FROM tenants
            ORDER BY id`,
        );

        return result.rows;
      },
    );

    if (
      visibleTenants.length !== 1 ||
      visibleTenants[0]?.id !== context.tenantId
    ) {
      throw new InternalServerErrorException(
        'Tenant RLS isolation gate failed',
      );
    }

    return {
      authenticated: true,
      rlsIsolated: true,
      tenantId: context.tenantId,
      visibleTenant: visibleTenants[0],
    };
  }
}
