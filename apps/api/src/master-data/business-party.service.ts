import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  parseCreateBusinessParty,
  parseUpdateBusinessParty,
  requireUuid,
  type BusinessPartyRole,
  type BusinessPartyStatus,
} from './business-party.validation.js';

export interface BusinessParty {
  readonly id: string;
  readonly taxId: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly status: BusinessPartyStatus;
  readonly roles: readonly BusinessPartyRole[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BusinessPartyAuditEntry {
  readonly id: string;
  readonly changeType: 'created' | 'updated';
  readonly actorUserId: string;
  readonly beforeSnapshot: BusinessPartySnapshot | null;
  readonly afterSnapshot: BusinessPartySnapshot;
  readonly createdAt: string;
}

interface BusinessPartySnapshot {
  readonly id: string;
  readonly taxId: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly status: BusinessPartyStatus;
  readonly roles: readonly BusinessPartyRole[];
}

interface BusinessPartyRow {
  readonly id: string;
  readonly tax_id: string;
  readonly legal_name: string;
  readonly trade_name: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly status: BusinessPartyStatus;
  readonly roles: BusinessPartyRole[] | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface BusinessPartyAuditRow {
  readonly id: string;
  readonly change_type: 'created' | 'updated';
  readonly actor_user_id: string;
  readonly before_snapshot: BusinessPartySnapshot | null;
  readonly after_snapshot: BusinessPartySnapshot;
  readonly created_at: Date;
}

const partySelect = `
  SELECT
    p.id::text AS id,
    p.tax_id,
    p.legal_name,
    p.trade_name,
    p.email,
    p.phone,
    p.status::text AS status,
    COALESCE(
      array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL),
      ARRAY[]::varchar[]
    ) AS roles,
    p.created_at,
    p.updated_at
  FROM business_parties p
  LEFT JOIN business_party_roles r
    ON r.tenant_id = p.tenant_id
   AND r.party_id = p.id
`;

@Injectable()
export class BusinessPartyService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async list(): Promise<readonly BusinessParty[]> {
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<BusinessPartyRow>(`${partySelect}
        GROUP BY p.id
        ORDER BY p.legal_name, p.id`);

      return result.rows.map(mapBusinessParty);
    });
  }

  async getById(id: string): Promise<BusinessParty> {
    const partyId = requireUuid(id);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      return this.requireParty(client, partyId);
    });
  }

  async create(input: unknown): Promise<BusinessParty> {
    const data = parseCreateBusinessParty(input);
    const context = this.tenantContext.require();

    try {
      return await this.database.withTenantContext(context, async (client) => {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO business_parties (
             tenant_id,
             tax_id,
             legal_name,
             trade_name,
             email,
             phone
           ) VALUES ($1::uuid, $2, $3, $4, $5, $6)
           RETURNING id::text AS id`,
          [context.tenantId, data.taxId, data.legalName, data.tradeName, data.email, data.phone],
        );

        const partyId = inserted.rows[0]!.id;
        await this.replaceRoles(client, context.tenantId, partyId, data.roles);
        const party = await this.requireParty(client, partyId);
        await this.writeAudit(client, {
          tenantId: context.tenantId,
          party,
          actorUserId: context.userId,
          changeType: 'created',
          before: null,
        });

        return party;
      });
    } catch (error) {
      this.rethrowDatabaseConstraint(error);
    }
  }

  async update(id: string, input: unknown): Promise<BusinessParty> {
    const partyId = requireUuid(id);
    const patch = parseUpdateBusinessParty(input);
    const context = this.tenantContext.require();

    try {
      return await this.database.withTenantContext(context, async (client) => {
        const before = await this.requireParty(client, partyId);
        const roles = patch.roles ?? before.roles;

        await client.query(
          `UPDATE business_parties
              SET tax_id = $2,
                  legal_name = $3,
                  trade_name = $4,
                  email = $5,
                  phone = $6,
                  status = $7::business_party_status,
                  updated_at = now()
            WHERE id = $1::uuid`,
          [
            partyId,
            patch.taxId ?? before.taxId,
            patch.legalName ?? before.legalName,
            patch.tradeName !== undefined ? patch.tradeName : before.tradeName,
            patch.email !== undefined ? patch.email : before.email,
            patch.phone !== undefined ? patch.phone : before.phone,
            patch.status ?? before.status,
          ],
        );

        if (patch.roles !== undefined) {
          await this.replaceRoles(client, context.tenantId, partyId, roles);
        }

        const after = await this.requireParty(client, partyId);
        await this.writeAudit(client, {
          tenantId: context.tenantId,
          party: after,
          actorUserId: context.userId,
          changeType: 'updated',
          before,
        });

        return after;
      });
    } catch (error) {
      this.rethrowDatabaseConstraint(error);
    }
  }

  async audit(id: string): Promise<readonly BusinessPartyAuditEntry[]> {
    const partyId = requireUuid(id);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireParty(client, partyId);

      const result = await client.query<BusinessPartyAuditRow>(
        `SELECT
           id::text AS id,
           change_type,
           actor_user_id::text AS actor_user_id,
           before_snapshot,
           after_snapshot,
           created_at
         FROM business_party_audit
         WHERE party_id = $1::uuid
         ORDER BY created_at, id`,
        [partyId],
      );

      return result.rows.map((row) => ({
        id: row.id,
        changeType: row.change_type,
        actorUserId: row.actor_user_id,
        beforeSnapshot: row.before_snapshot,
        afterSnapshot: row.after_snapshot,
        createdAt: row.created_at.toISOString(),
      }));
    });
  }

  private async requireParty(client: TenantQueryClient, partyId: string): Promise<BusinessParty> {
    const result = await client.query<BusinessPartyRow>(
      `${partySelect}
      WHERE p.id = $1::uuid
      GROUP BY p.id`,
      [partyId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Business party was not found');
    }

    return mapBusinessParty(row);
  }

  private async replaceRoles(
    client: TenantQueryClient,
    tenantId: string,
    partyId: string,
    roles: readonly BusinessPartyRole[],
  ): Promise<void> {
    await client.query('DELETE FROM business_party_roles WHERE party_id = $1::uuid', [partyId]);
    await client.query(
      `INSERT INTO business_party_roles (tenant_id, party_id, role)
       SELECT $1::uuid, $2::uuid, value
       FROM unnest($3::varchar[]) AS value`,
      [tenantId, partyId, roles],
    );
  }

  private async writeAudit(
    client: TenantQueryClient,
    change: {
      readonly tenantId: string;
      readonly party: BusinessParty;
      readonly actorUserId: string;
      readonly changeType: 'created' | 'updated';
      readonly before: BusinessParty | null;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO business_party_audit (
         tenant_id,
         party_id,
         actor_user_id,
         change_type,
         before_snapshot,
         after_snapshot
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6::jsonb)`,
      [
        change.tenantId,
        change.party.id,
        change.actorUserId,
        change.changeType,
        change.before ? JSON.stringify(snapshot(change.before)) : null,
        JSON.stringify(snapshot(change.party)),
      ],
    );
  }

  private rethrowDatabaseConstraint(error: unknown): never {
    if (isPgError(error, '23505')) {
      throw new ConflictException('A business party with this taxId already exists in this tenant');
    }

    throw error;
  }
}

function mapBusinessParty(row: BusinessPartyRow): BusinessParty {
  return {
    id: row.id,
    taxId: row.tax_id,
    legalName: row.legal_name,
    tradeName: row.trade_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    roles: row.roles ?? [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function snapshot(party: BusinessParty): BusinessPartySnapshot {
  return {
    id: party.id,
    taxId: party.taxId,
    legalName: party.legalName,
    tradeName: party.tradeName,
    email: party.email,
    phone: party.phone,
    status: party.status,
    roles: party.roles,
  };
}

function isPgError(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code);
}
