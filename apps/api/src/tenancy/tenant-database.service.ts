import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';

import type { TenantContextSnapshot } from './tenant-context.js';

export type TenantQueryClient = PoolClient;

export interface IntegrationAuthenticationRecord {
  readonly clientId: string;
  readonly tenantId: string;
  readonly clientName: string;
  readonly scopes: readonly string[];
}

export interface IntegrationDatabaseContext {
  readonly clientId: string;
  readonly tenantId: string;
}

@Injectable()
export class TenantDatabaseService implements OnModuleDestroy {
  private pool?: Pool;

  async checkReadiness(): Promise<void> {
    const client = await this.getPool().connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  async withUserDiscoveryContext<T>(
    userId: string,
    work: (client: TenantQueryClient) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(userId, '', '', work);
  }

  async withTenantContext<T>(
    context: TenantContextSnapshot,
    work: (client: TenantQueryClient) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(context.userId, context.tenantId, '', work);
  }

  async authenticateIntegrationClient(
    clientId: string,
    secretHashHex: string,
  ): Promise<IntegrationAuthenticationRecord | null> {
    return this.withTransaction('', '', '', async (client) => {
      const result = await client.query<{
        client_id: string;
        tenant_id: string;
        client_name: string;
        scopes: string[];
      }>('SELECT * FROM nexora_authenticate_integration_client($1::uuid,$2::text)', [
        clientId,
        secretHashHex,
      ]);
      const row = result.rows[0];
      if (!row) return null;
      return {
        clientId: row.client_id,
        tenantId: row.tenant_id,
        clientName: row.client_name,
        scopes: Object.freeze([...row.scopes]),
      };
    });
  }

  async withIntegrationContext<T>(
    context: IntegrationDatabaseContext,
    work: (client: TenantQueryClient) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction('', context.tenantId, context.clientId, work);
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
      throw new ServiceUnavailableException('DATABASE_URL is not configured for the API runtime');
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
    integrationClientId: string,
    work: (client: TenantQueryClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getPool().connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `SELECT
           set_config('app.user_id', $1, true),
           set_config('app.tenant_id', $2, true),
           set_config('app.integration_client_id', $3, true)`,
        [userId, tenantId, integrationClientId],
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
