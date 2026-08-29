import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  parseTransportCargoProfile,
  type TransportCargoProfileInput,
} from './transport-cargo.validation.js';
import { requireUuid, type TransportRequestStatus } from './transport-request.validation.js';

interface RequestStatusRow {
  readonly status: TransportRequestStatus;
}

interface CargoProfileRow {
  readonly id: string;
  readonly transport_request_id: string;
  readonly material: string;
  readonly cargo_type: string;
  readonly total_weight_kg: string;
  readonly volume_count: number;
  readonly pallet_count: number;
  readonly cubage_m3: string | null;
  readonly max_length_m: string | null;
  readonly max_width_m: string | null;
  readonly max_height_m: string | null;
  readonly tracking_required: boolean;
  readonly vehicle_type: string;
  readonly body_type: string;
  readonly non_stackable: boolean;
  readonly special_cargo: boolean;
  readonly special_instructions: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface TransportCargoProfile {
  readonly id: string;
  readonly transportRequestId: string;
  readonly material: string;
  readonly cargoType: string;
  readonly totalWeightKg: string;
  readonly volumeCount: number;
  readonly palletCount: number;
  readonly cubageM3: string | null;
  readonly maxLengthM: string | null;
  readonly maxWidthM: string | null;
  readonly maxHeightM: string | null;
  readonly trackingRequired: boolean;
  readonly vehicleType: string;
  readonly bodyType: string;
  readonly nonStackable: boolean;
  readonly specialCargo: boolean;
  readonly specialInstructions: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

@Injectable()
export class TransportCargoService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async getProfile(requestId: string): Promise<TransportCargoProfile | null> {
    const id = requireUuid(requestId, 'requestId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireRequest(client, id);
      return this.loadProfile(client, id);
    });
  }

  async upsertProfile(requestId: string, input: unknown): Promise<TransportCargoProfile> {
    const id = requireUuid(requestId, 'requestId');
    const profile = parseTransportCargoProfile(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const request = await this.requireRequest(client, id);
      if (request.status !== 'draft' && request.status !== 'ready_for_quote') {
        throw new ConflictException(
          `Cargo profile cannot be edited while transport request status is ${request.status}`,
        );
      }

      await this.writeProfile(client, context.tenantId, id, profile);
      const saved = await this.loadProfile(client, id);
      if (!saved) {
        throw new NotFoundException('Cargo profile was not persisted');
      }
      return saved;
    });
  }

  private async requireRequest(
    client: TenantQueryClient,
    requestId: string,
  ): Promise<RequestStatusRow> {
    const result = await client.query<RequestStatusRow>(
      `SELECT status::text AS status
         FROM transport_requests
        WHERE id = $1::uuid`,
      [requestId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Transport request not found in current tenant');
    }
    return row;
  }

  private async writeProfile(
    client: TenantQueryClient,
    tenantId: string,
    requestId: string,
    profile: TransportCargoProfileInput,
  ): Promise<void> {
    await client.query(
      `INSERT INTO transport_request_cargo_profiles (
         tenant_id, transport_request_id, material, cargo_type, total_weight_kg,
         volume_count, pallet_count, cubage_m3, max_length_m, max_width_m, max_height_m,
         tracking_required, vehicle_type, body_type, non_stackable, special_cargo,
         special_instructions
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, $5::numeric,
         $6, $7, $8::numeric, $9::numeric, $10::numeric, $11::numeric,
         $12, $13, $14, $15, $16, $17
       )
       ON CONFLICT (tenant_id, transport_request_id) DO UPDATE SET
         material = EXCLUDED.material,
         cargo_type = EXCLUDED.cargo_type,
         total_weight_kg = EXCLUDED.total_weight_kg,
         volume_count = EXCLUDED.volume_count,
         pallet_count = EXCLUDED.pallet_count,
         cubage_m3 = EXCLUDED.cubage_m3,
         max_length_m = EXCLUDED.max_length_m,
         max_width_m = EXCLUDED.max_width_m,
         max_height_m = EXCLUDED.max_height_m,
         tracking_required = EXCLUDED.tracking_required,
         vehicle_type = EXCLUDED.vehicle_type,
         body_type = EXCLUDED.body_type,
         non_stackable = EXCLUDED.non_stackable,
         special_cargo = EXCLUDED.special_cargo,
         special_instructions = EXCLUDED.special_instructions,
         updated_at = now()`,
      [
        tenantId,
        requestId,
        profile.material,
        profile.cargoType,
        profile.totalWeightKg,
        profile.volumeCount,
        profile.palletCount,
        profile.cubageM3,
        profile.maxLengthM,
        profile.maxWidthM,
        profile.maxHeightM,
        profile.trackingRequired,
        profile.vehicleType,
        profile.bodyType,
        profile.nonStackable,
        profile.specialCargo,
        profile.specialInstructions,
      ],
    );
  }

  private async loadProfile(
    client: TenantQueryClient,
    requestId: string,
  ): Promise<TransportCargoProfile | null> {
    const result = await client.query<CargoProfileRow>(
      `SELECT
         id::text AS id,
         transport_request_id::text AS transport_request_id,
         material,
         cargo_type,
         total_weight_kg::text AS total_weight_kg,
         volume_count,
         pallet_count,
         cubage_m3::text AS cubage_m3,
         max_length_m::text AS max_length_m,
         max_width_m::text AS max_width_m,
         max_height_m::text AS max_height_m,
         tracking_required,
         vehicle_type,
         body_type,
         non_stackable,
         special_cargo,
         special_instructions,
         created_at,
         updated_at
       FROM transport_request_cargo_profiles
       WHERE transport_request_id = $1::uuid`,
      [requestId],
    );
    const row = result.rows[0];
    return row ? mapCargoProfile(row) : null;
  }
}

function mapCargoProfile(row: CargoProfileRow): TransportCargoProfile {
  return {
    id: row.id,
    transportRequestId: row.transport_request_id,
    material: row.material,
    cargoType: row.cargo_type,
    totalWeightKg: row.total_weight_kg,
    volumeCount: row.volume_count,
    palletCount: row.pallet_count,
    cubageM3: row.cubage_m3,
    maxLengthM: row.max_length_m,
    maxWidthM: row.max_width_m,
    maxHeightM: row.max_height_m,
    trackingRequired: row.tracking_required,
    vehicleType: row.vehicle_type,
    bodyType: row.body_type,
    nonStackable: row.non_stackable,
    specialCargo: row.special_cargo,
    specialInstructions: row.special_instructions,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
