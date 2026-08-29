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
  parseCloseCapacityAssignment,
  parseCreateCapacityAssignment,
  validateAssignmentPeriod,
  type CapacityAssignmentStatus,
} from './capacity-assignment.validation.js';

export interface CapacityComposition {
  readonly id: string;
  readonly driverId: string;
  readonly driverName: string;
  readonly vehicleId: string;
  readonly vehicleIdentifier: string;
  readonly vehiclePlate: string | null;
  readonly carrierPartyId: string;
  readonly carrierName: string;
  readonly status: CapacityAssignmentStatus;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly statusReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface CapacityCompositionRow {
  readonly id: string;
  readonly driver_id: string;
  readonly driver_name: string;
  readonly vehicle_id: string;
  readonly vehicle_identifier: string;
  readonly vehicle_plate: string | null;
  readonly carrier_party_id: string;
  readonly carrier_name: string;
  readonly status: CapacityAssignmentStatus;
  readonly starts_at: Date;
  readonly ends_at: Date | null;
  readonly status_reason: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface DriverEligibilityRow {
  readonly carrier_party_id: string | null;
  readonly registration_status: string;
  readonly operational_status: string;
}

interface VehicleEligibilityRow {
  readonly carrier_party_id: string | null;
  readonly asset_kind: string;
  readonly status: string;
}

@Injectable()
export class CapacityAssignmentService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async active(): Promise<readonly CapacityComposition[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<CapacityCompositionRow>(
        `${compositionSelect} WHERE a.status='active' ORDER BY d.full_name, v.identifier, a.starts_at`,
      );
      return result.rows.map(mapComposition);
    });
  }

  async history(): Promise<readonly CapacityComposition[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<CapacityCompositionRow>(
        `${compositionSelect} ORDER BY a.starts_at DESC, a.id`,
      );
      return result.rows.map(mapComposition);
    });
  }

  async getById(id: string): Promise<CapacityComposition> {
    const assignmentId = requireUuid(id);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, (client) =>
      this.requireAssignment(client, assignmentId),
    );
  }

  async create(input: unknown): Promise<CapacityComposition> {
    const data = parseCreateCapacityAssignment(input);
    const context = this.tenantContext.require();

    try {
      return await this.database.withTenantContext(context, async (client) => {
        await this.validateCarrier(client, data.carrierPartyId);
        await this.validateDriver(client, data.driverId, data.carrierPartyId);
        await this.validateVehicle(client, data.vehicleId, data.carrierPartyId);

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO capacity_assignments (
             tenant_id,driver_id,vehicle_id,carrier_party_id,status,starts_at,
             created_by_user_id,updated_by_user_id
           ) VALUES (
             $1::uuid,$2::uuid,$3::uuid,$4::uuid,'active',coalesce($5::timestamptz,now()),$6::uuid,$6::uuid
           ) RETURNING id::text AS id`,
          [
            context.tenantId,
            data.driverId,
            data.vehicleId,
            data.carrierPartyId,
            data.startsAt,
            context.userId,
          ],
        );
        return this.requireAssignment(client, inserted.rows[0]!.id);
      });
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async close(id: string, input: unknown): Promise<CapacityComposition> {
    const assignmentId = requireUuid(id);
    const data = parseCloseCapacityAssignment(input);
    const context = this.tenantContext.require();

    try {
      return await this.database.withTenantContext(context, async (client) => {
        const before = await this.requireAssignment(client, assignmentId);
        if (before.status !== 'active') {
          throw new ConflictException('Only an active capacity assignment can be closed');
        }
        const endsAt = data.endsAt ? new Date(data.endsAt) : new Date();
        validateAssignmentPeriod(new Date(before.startsAt), endsAt);

        await client.query(
          `UPDATE capacity_assignments
              SET status=$2::capacity_assignment_status,
                  ends_at=$3::timestamptz,
                  status_reason=$4,
                  updated_by_user_id=$5::uuid,
                  updated_at=now()
            WHERE id=$1::uuid AND status='active'`,
          [assignmentId, data.status, endsAt.toISOString(), data.statusReason, context.userId],
        );
        return this.requireAssignment(client, assignmentId);
      });
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  private async requireAssignment(
    client: TenantQueryClient,
    id: string,
  ): Promise<CapacityComposition> {
    const result = await client.query<CapacityCompositionRow>(
      `${compositionSelect} WHERE a.id=$1::uuid`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Capacity assignment not found');
    return mapComposition(row);
  }

  private async validateCarrier(client: TenantQueryClient, carrierPartyId: string): Promise<void> {
    const result = await client.query(
      `SELECT 1
         FROM business_parties p
         JOIN business_party_roles r ON r.tenant_id=p.tenant_id AND r.party_id=p.id
        WHERE p.id=$1::uuid AND p.status='active' AND r.role='carrier'
        LIMIT 1`,
      [carrierPartyId],
    );
    if (result.rowCount !== 1) {
      throw new BadRequestException(
        'carrierPartyId must reference an active carrier in the current tenant',
      );
    }
  }

  private async validateDriver(
    client: TenantQueryClient,
    driverId: string,
    carrierPartyId: string,
  ): Promise<void> {
    const result = await client.query<DriverEligibilityRow>(
      `SELECT carrier_party_id::text AS carrier_party_id,
              registration_status::text AS registration_status,
              operational_status::text AS operational_status
         FROM drivers WHERE id=$1::uuid`,
      [driverId],
    );
    const driver = result.rows[0];
    if (!driver)
      throw new BadRequestException('driverId must reference a driver in the current tenant');
    if (driver.registration_status !== 'qualified' || driver.operational_status !== 'active') {
      throw new BadRequestException('driverId must reference a qualified and active driver');
    }
    if (driver.carrier_party_id && driver.carrier_party_id !== carrierPartyId) {
      throw new BadRequestException('Driver is linked to a different carrier');
    }
  }

  private async validateVehicle(
    client: TenantQueryClient,
    vehicleId: string,
    carrierPartyId: string,
  ): Promise<void> {
    const result = await client.query<VehicleEligibilityRow>(
      `SELECT carrier_party_id::text AS carrier_party_id,
              asset_kind::text AS asset_kind,
              status::text AS status
         FROM capacity_assets WHERE id=$1::uuid`,
      [vehicleId],
    );
    const vehicle = result.rows[0];
    if (!vehicle) {
      throw new BadRequestException(
        'vehicleId must reference a capacity asset in the current tenant',
      );
    }
    if (vehicle.asset_kind !== 'vehicle') {
      throw new BadRequestException('vehicleId must reference an asset of kind vehicle');
    }
    if (vehicle.status !== 'active') {
      throw new BadRequestException('vehicleId must reference an active vehicle');
    }
    if (vehicle.carrier_party_id && vehicle.carrier_party_id !== carrierPartyId) {
      throw new BadRequestException('Vehicle is linked to a different carrier');
    }
  }

  private rethrowConstraint(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if (code === '23505') {
      throw new ConflictException('Driver or vehicle already has an active assignment');
    }
    if (code === '23503' || code === '23514') {
      throw new BadRequestException('Capacity assignment violates a business constraint');
    }
    throw error;
  }
}

const compositionSelect = `SELECT a.id::text AS id,
  a.driver_id::text AS driver_id,d.full_name AS driver_name,
  a.vehicle_id::text AS vehicle_id,v.identifier AS vehicle_identifier,v.plate AS vehicle_plate,
  a.carrier_party_id::text AS carrier_party_id,p.legal_name AS carrier_name,
  a.status::text AS status,a.starts_at,a.ends_at,a.status_reason,a.created_at,a.updated_at
  FROM capacity_assignments a
  JOIN drivers d ON d.tenant_id=a.tenant_id AND d.id=a.driver_id
  JOIN capacity_assets v ON v.tenant_id=a.tenant_id AND v.id=a.vehicle_id
  JOIN business_parties p ON p.tenant_id=a.tenant_id AND p.id=a.carrier_party_id`;

function mapComposition(row: CapacityCompositionRow): CapacityComposition {
  return {
    id: row.id,
    driverId: row.driver_id,
    driverName: row.driver_name,
    vehicleId: row.vehicle_id,
    vehicleIdentifier: row.vehicle_identifier,
    vehiclePlate: row.vehicle_plate,
    carrierPartyId: row.carrier_party_id,
    carrierName: row.carrier_name,
    status: row.status,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at?.toISOString() ?? null,
    statusReason: row.status_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function requireUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BadRequestException('id must be a valid UUID');
  }
  return value;
}
