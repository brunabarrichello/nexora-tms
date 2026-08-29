import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  parseCreateDriver,
  parseUpdateDriver,
  validateDriverStatusCombination,
  type DriverOperationalStatus,
  type DriverRegistrationStatus,
} from './driver.validation.js';

export interface Driver {
  readonly id: string;
  readonly carrierPartyId: string | null;
  readonly fullName: string;
  readonly taxId: string;
  readonly email: string | null;
  readonly phone: string;
  readonly whatsapp: string | null;
  readonly cnhNumber: string;
  readonly cnhCategory: string;
  readonly cnhExpiresOn: string;
  readonly registrationStatus: DriverRegistrationStatus;
  readonly operationalStatus: DriverOperationalStatus;
  readonly statusReason: string | null;
  readonly eligibleForMatching: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DriverAuditEntry {
  readonly id: string;
  readonly changeType: 'created' | 'updated' | 'status_changed';
  readonly actorUserId: string;
  readonly beforeSnapshot: DriverSnapshot | null;
  readonly afterSnapshot: DriverSnapshot;
  readonly createdAt: string;
}

interface DriverSnapshot {
  readonly id: string;
  readonly carrierPartyId: string | null;
  readonly fullName: string;
  readonly taxId: string;
  readonly email: string | null;
  readonly phone: string;
  readonly whatsapp: string | null;
  readonly cnhNumber: string;
  readonly cnhCategory: string;
  readonly cnhExpiresOn: string;
  readonly registrationStatus: DriverRegistrationStatus;
  readonly operationalStatus: DriverOperationalStatus;
  readonly statusReason: string | null;
}

interface DriverRow {
  readonly id: string;
  readonly carrier_party_id: string | null;
  readonly full_name: string;
  readonly tax_id: string;
  readonly email: string | null;
  readonly phone: string;
  readonly whatsapp: string | null;
  readonly cnh_number: string;
  readonly cnh_category: string;
  readonly cnh_expires_on: string;
  readonly registration_status: DriverRegistrationStatus;
  readonly operational_status: DriverOperationalStatus;
  readonly status_reason: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface DriverAuditRow {
  readonly id: string;
  readonly change_type: 'created' | 'updated' | 'status_changed';
  readonly actor_user_id: string;
  readonly before_snapshot: DriverSnapshot | null;
  readonly after_snapshot: DriverSnapshot;
  readonly created_at: Date;
}

@Injectable()
export class DriverService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async list(): Promise<readonly Driver[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<DriverRow>(`${driverSelect} ORDER BY full_name, id`);
      return result.rows.map(mapDriver);
    });
  }

  async getById(id: string): Promise<Driver> {
    const driverId = requireUuid(id);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, (client) =>
      this.requireDriver(client, driverId),
    );
  }

  async create(input: unknown): Promise<Driver> {
    const data = parseCreateDriver(input);
    const context = this.tenantContext.require();

    try {
      return await this.database.withTenantContext(context, async (client) => {
        await this.validateCarrier(client, data.carrierPartyId);
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO drivers (
             tenant_id, carrier_party_id, full_name, tax_id, email, phone, whatsapp,
             cnh_number, cnh_category, cnh_expires_on, registration_status,
             operational_status, status_reason, created_by_user_id, updated_by_user_id
           ) VALUES (
             $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::date,
             $11::driver_registration_status, $12::driver_operational_status, $13,
             $14::uuid, $14::uuid
           ) RETURNING id::text AS id`,
          [
            context.tenantId,
            data.carrierPartyId,
            data.fullName,
            data.taxId,
            data.email,
            data.phone,
            data.whatsapp,
            data.cnhNumber,
            data.cnhCategory,
            data.cnhExpiresOn,
            data.registrationStatus,
            data.operationalStatus,
            data.statusReason,
            context.userId,
          ],
        );
        const driver = await this.requireDriver(client, inserted.rows[0]!.id);
        await this.writeAudit(client, context.tenantId, context.userId, 'created', null, driver);
        return driver;
      });
    } catch (error) {
      this.rethrowDatabaseConstraint(error);
    }
  }

  async update(id: string, input: unknown): Promise<Driver> {
    const driverId = requireUuid(id);
    const patch = parseUpdateDriver(input);
    const context = this.tenantContext.require();

    try {
      return await this.database.withTenantContext(context, async (client) => {
        const before = await this.requireDriver(client, driverId);
        const carrierPartyId =
          patch.carrierPartyId !== undefined ? patch.carrierPartyId : before.carrierPartyId;
        await this.validateCarrier(client, carrierPartyId);

        const registrationStatus = patch.registrationStatus ?? before.registrationStatus;
        const operationalStatus = patch.operationalStatus ?? before.operationalStatus;
        const statusReason =
          patch.statusReason !== undefined ? patch.statusReason : before.statusReason;
        validateDriverStatusCombination(registrationStatus, operationalStatus, statusReason);

        await client.query(
          `UPDATE drivers
              SET carrier_party_id = $2::uuid,
                  full_name = $3,
                  tax_id = $4,
                  email = $5,
                  phone = $6,
                  whatsapp = $7,
                  cnh_number = $8,
                  cnh_category = $9,
                  cnh_expires_on = $10::date,
                  registration_status = $11::driver_registration_status,
                  operational_status = $12::driver_operational_status,
                  status_reason = $13,
                  updated_by_user_id = $14::uuid,
                  updated_at = now()
            WHERE id = $1::uuid`,
          [
            driverId,
            carrierPartyId,
            patch.fullName ?? before.fullName,
            patch.taxId ?? before.taxId,
            patch.email !== undefined ? patch.email : before.email,
            patch.phone ?? before.phone,
            patch.whatsapp !== undefined ? patch.whatsapp : before.whatsapp,
            patch.cnhNumber ?? before.cnhNumber,
            patch.cnhCategory ?? before.cnhCategory,
            patch.cnhExpiresOn ?? before.cnhExpiresOn,
            registrationStatus,
            operationalStatus,
            statusReason,
            context.userId,
          ],
        );

        const after = await this.requireDriver(client, driverId);
        const statusChanged =
          before.registrationStatus !== after.registrationStatus ||
          before.operationalStatus !== after.operationalStatus ||
          before.statusReason !== after.statusReason;
        await this.writeAudit(
          client,
          context.tenantId,
          context.userId,
          statusChanged ? 'status_changed' : 'updated',
          before,
          after,
        );
        return after;
      });
    } catch (error) {
      this.rethrowDatabaseConstraint(error);
    }
  }

  async audit(id: string): Promise<readonly DriverAuditEntry[]> {
    const driverId = requireUuid(id);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireDriver(client, driverId);
      const result = await client.query<DriverAuditRow>(
        `SELECT id::text AS id, change_type, actor_user_id::text AS actor_user_id,
                before_snapshot, after_snapshot, created_at
           FROM driver_audit
          WHERE driver_id = $1::uuid
          ORDER BY created_at, id`,
        [driverId],
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

  private async requireDriver(client: TenantQueryClient, id: string): Promise<Driver> {
    const result = await client.query<DriverRow>(`${driverSelect} WHERE id = $1::uuid`, [id]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Driver not found');
    return mapDriver(row);
  }

  private async validateCarrier(
    client: TenantQueryClient,
    carrierPartyId: string | null,
  ): Promise<void> {
    if (!carrierPartyId) return;
    const result = await client.query(
      `SELECT 1
         FROM business_parties p
         JOIN business_party_roles r
           ON r.tenant_id = p.tenant_id AND r.party_id = p.id
        WHERE p.id = $1::uuid
          AND p.status = 'active'
          AND r.role = 'carrier'
        LIMIT 1`,
      [carrierPartyId],
    );
    if (result.rowCount !== 1) {
      throw new BadRequestException(
        'carrierPartyId must reference an active carrier in the current tenant',
      );
    }
  }

  private async writeAudit(
    client: TenantQueryClient,
    tenantId: string,
    actorUserId: string,
    changeType: 'created' | 'updated' | 'status_changed',
    before: Driver | null,
    after: Driver,
  ): Promise<void> {
    await client.query(
      `INSERT INTO driver_audit (
         tenant_id, driver_id, actor_user_id, change_type, before_snapshot, after_snapshot
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6::jsonb)`,
      [
        tenantId,
        after.id,
        actorUserId,
        changeType,
        before ? JSON.stringify(snapshot(before)) : null,
        JSON.stringify(snapshot(after)),
      ],
    );
  }

  private rethrowDatabaseConstraint(error: unknown): never {
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if (code === '23505')
      throw new ConflictException('Driver CPF or CNH is already registered for this tenant');
    if (code === '23503' || code === '23514')
      throw new BadRequestException('Driver data violates a business constraint');
    throw error;
  }
}

const driverSelect = `SELECT id::text AS id, carrier_party_id::text AS carrier_party_id,
  full_name, tax_id, email, phone, whatsapp, cnh_number, cnh_category,
  cnh_expires_on::text AS cnh_expires_on, registration_status::text AS registration_status,
  operational_status::text AS operational_status, status_reason, created_at, updated_at FROM drivers`;

function mapDriver(row: DriverRow): Driver {
  return {
    id: row.id,
    carrierPartyId: row.carrier_party_id,
    fullName: row.full_name,
    taxId: row.tax_id,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    cnhNumber: row.cnh_number,
    cnhCategory: row.cnh_category,
    cnhExpiresOn: row.cnh_expires_on,
    registrationStatus: row.registration_status,
    operationalStatus: row.operational_status,
    statusReason: row.status_reason,
    eligibleForMatching:
      row.registration_status === 'qualified' && row.operational_status === 'active',
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function snapshot(driver: Driver): DriverSnapshot {
  return {
    id: driver.id,
    carrierPartyId: driver.carrierPartyId,
    fullName: driver.fullName,
    taxId: driver.taxId,
    email: driver.email,
    phone: driver.phone,
    whatsapp: driver.whatsapp,
    cnhNumber: driver.cnhNumber,
    cnhCategory: driver.cnhCategory,
    cnhExpiresOn: driver.cnhExpiresOn,
    registrationStatus: driver.registrationStatus,
    operationalStatus: driver.operationalStatus,
    statusReason: driver.statusReason,
  };
}

function requireUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BadRequestException('id must be a valid UUID');
  }
  return value;
}
