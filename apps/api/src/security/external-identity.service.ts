import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class ExternalIdentityService implements OnModuleDestroy {
  private pool?: Pool;

  async resolveActiveUser(
    providerKey: string,
    subject: string,
  ): Promise<string | undefined> {
    const result = await this.getPool().query<{ user_id: string }>(
      `SELECT external_identities.user_id::text AS user_id
         FROM external_identities
         JOIN users ON users.id = external_identities.user_id
        WHERE external_identities.provider = $1
          AND external_identities.subject = $2
          AND users.status = 'active'
        LIMIT 1`,
      [providerKey, subject],
    );

    return result.rows[0]?.user_id;
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
        'DATABASE_URL is not configured for authentication identity resolution',
      );
    }

    const configuredMax = Number.parseInt(
      process.env.AUTH_DATABASE_POOL_MAX ?? '4',
      10,
    );
    const max =
      Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 4;

    this.pool = new Pool({
      application_name: 'nexora-tms-api-auth',
      connectionString,
      max,
    });

    return this.pool;
  }
}
