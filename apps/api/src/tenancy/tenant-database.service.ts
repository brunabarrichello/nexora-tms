import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';

import type { TenantContextSnapshot } from './tenant-context.js';

export type TenantQueryClient = PoolClient;

@Injectable()
export class TenantDatabaseService implements OnModuleDestroy {
  private pool?: Pool;

  async withUserDiscoveryContext<T>(
    userId: string,
    work: (client: TenantQueryClient) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(userId, '', work);
  }

  async withTenantContext<T>(
    context: TenantContextSnapshot,
    work: (client: TenantQueryClient) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(context.userId, context.tenantId, work);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  private getPool(): Pool {
    if (this.pool) {
      return this.pool;
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured for the API runtime',
      );
    }

    const configuredMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10);
    const max = Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 10;

    this.pool = new Pool({
      application_name: 'nexora-tms-api',
      connectionString,
      max,
    });

    return this.pool;
  }

  private async withTransaction<T>(
    userId: string,
    tenantId: string,
    work: (client: TenantQueryClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getPool().connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `SELECT
           set_config('app.user_id', $1, true),
           set_config('app.tenant_id', $2, true)`,
        [userId, tenantId],
      );

      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
