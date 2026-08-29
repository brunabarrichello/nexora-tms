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
  parseCreateCapacityAsset,
  parseUpdateCapacityAsset,
  validateCapacityAssetDimensions,
  validateCapacityAssetOwnership,
  validateCapacityAssetState,
  type CapacityAssetKind,
  type CapacityAssetStatus,
} from './capacity-asset.validation.js';

export interface CapacityAsset {
  readonly id: string;
  readonly carrierPartyId: string | null;
  readonly ownerPartyId: string | null;
  readonly ownerName: string | null;
  readonly assetKind: CapacityAssetKind;
  readonly identifier: string;
  readonly plate: string | null;
  readonly vehicleType: string;
  readonly bodyType: string;
  readonly capacityWeightKg: number;
  readonly capacityVolumeM3: number | null;
  readonly maxLengthM: number | null;
  readonly maxWidthM: number | null;
  readonly maxHeightM: number | null;
  readonly trackingAvailable: boolean;
  readonly status: CapacityAssetStatus;
  readonly statusReason: string | null;
  readonly eligibleForMatching: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CapacityAssetAuditEntry {
  readonly id: string;
  readonly changeType: 'created' | 'updated' | 'status_changed';
  readonly actorUserId: string;
  readonly beforeSnapshot: CapacityAssetSnapshot | null;
  readonly afterSnapshot: CapacityAssetSnapshot;
  readonly createdAt: string;
}

interface CapacityAssetSnapshot {
  readonly id: string;
  readonly carrierPartyId: string | null;
  readonly ownerPartyId: string | null;
  readonly ownerName: string | null;
  readonly assetKind: CapacityAssetKind;
  readonly identifier: string;
  readonly plate: string | null;
  readonly vehicleType: string;
  readonly bodyType: string;
  readonly capacityWeightKg: number;
  readonly capacityVolumeM3: number | null;
  readonly maxLengthM: number | null;
  readonly maxWidthM: number | null;
  readonly maxHeightM: number | null;
  readonly trackingAvailable: boolean;
  readonly status: CapacityAssetStatus;
  readonly statusReason: string | null;
}

interface CapacityAssetRow {
  readonly id: string;
  readonly carrier_party_id: string | null;
  readonly owner_party_id: string | null;
  readonly owner_name: string | null;
  readonly asset_kind: CapacityAssetKind;
  readonly identifier: string;
  readonly plate: string | null;
  readonly vehicle_type: string;
  readonly body_type: string;
  readonly capacity_weight_kg: string;
  readonly capacity_volume_m3: string | null;
  readonly max_length_m: string | null;
  readonly max_width_m: string | null;
  readonly max_height_m: string | null;
  readonly tracking_available: boolean;
  readonly status: CapacityAssetStatus;
  readonly status_reason: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface CapacityAssetAuditRow {
  readonly id: string;
  readonly change_type: 'created' | 'updated' | 'status_changed';
  readonly actor_user_id: string;
  readonly before_snapshot: CapacityAssetSnapshot | null;
  readonly after_snapshot: CapacityAssetSnapshot;
  readonly created_at: Date;
}

@Injectable()
export class CapacityAssetService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async list(): Promise<readonly CapacityAsset[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<CapacityAssetRow>(`${assetSelect} ORDER BY identifier, id`);
      return result.rows.map(mapAsset);
    });
  }

  async getById(id: string): Promise<CapacityAsset> {
    const assetId = requireUuid(id);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, (client) => this.requireAsset(client, assetId));
  }

  async create(input: unknown): Promise<CapacityAsset> {
    const data = parseCreateCapacityAsset(input);
    const context = this.tenantContext.require();

    try {
      return await this.database.withTenantContext(context, async (client) => {
        await this.validateCarrier(client, data.carrierPartyId);
        await this.validateOwner(client, data.ownerPartyId);
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO capacity_assets (
             tenant_id, carrier_party_id, owner_party_id, owner_name, asset_kind, identifier, plate,
             vehicle_type, body_type, capacity_weight_kg, capacity_volume_m3,
             max_length_m, max_width_m, max_height_m, tracking_available, status, status_reason,
             created_by_user_id, updated_by_user_id
           ) VALUES (
             $1::uuid, $2::uuid, $3::uuid, $4, $5::capacity_asset_kind, $6, $7, $8, $9,
             $10, $11, $12, $13, $14, $15, $16::capacity_asset_status, $17,
             $18::uuid, $18::uuid
           ) RETURNING id::text AS id`,
          [
            context.tenantId,
            data.carrierPartyId,
            data.ownerPartyId,
            data.ownerName,
            data.assetKind,
            data.identifier,
            data.plate,
            data.vehicleType,
            data.bodyType,
            data.capacityWeightKg,
            data.capacityVolumeM3,
            data.maxLengthM,
            data.maxWidthM,
            data.maxHeightM,
            data.trackingAvailable,
            data.status,
            data.statusReason,
            context.userId,
          ],
        );
        const asset = await this.requireAsset(client, inserted.rows[0]!.id);
        await this.writeAudit(client, context.tenantId, context.userId, 'created', null, asset);
        return asset;
      });
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async update(id: string, input: unknown): Promise<CapacityAsset> {
    const assetId = requireUuid(id);
    const patch = parseUpdateCapacityAsset(input);
    const context = this.tenantContext.require();

    try {
      return await this.database.withTenantContext(context, async (client) => {
        const before = await this.requireAsset(client, assetId);
        const carrierPartyId =
          patch.carrierPartyId !== undefined ? patch.carrierPartyId : before.carrierPartyId;
        const ownerPartyId =
          patch.ownerPartyId !== undefined ? patch.ownerPartyId : before.ownerPartyId;
        const ownerName = patch.ownerName !== undefined ? patch.ownerName : before.ownerName;
        const maxLengthM = patch.maxLengthM !== undefined ? patch.maxLengthM : before.maxLengthM;
        const maxWidthM = patch.maxWidthM !== undefined ? patch.maxWidthM : before.maxWidthM;
        const maxHeightM = patch.maxHeightM !== undefined ? patch.maxHeightM : before.maxHeightM;
        const assetStatus = patch.status ?? before.status;
        const statusReason =
          patch.statusReason !== undefined ? patch.statusReason : before.statusReason;

        validateCapacityAssetOwnership(carrierPartyId, ownerPartyId, ownerName);
        validateCapacityAssetDimensions(maxLengthM, maxWidthM, maxHeightM);
        validateCapacityAssetState(assetStatus, statusReason);
        await this.validateCarrier(client, carrierPartyId);
        await this.validateOwner(client, ownerPartyId);

        await client.query(
          `UPDATE capacity_assets
              SET carrier_party_id=$2::uuid,
                  owner_party_id=$3::uuid,
                  owner_name=$4,
                  asset_kind=$5::capacity_asset_kind,
                  identifier=$6,
                  plate=$7,
                  vehicle_type=$8,
                  body_type=$9,
                  capacity_weight_kg=$10,
                  capacity_volume_m3=$11,
                  max_length_m=$12,
                  max_width_m=$13,
                  max_height_m=$14,
                  tracking_available=$15,
                  status=$16::capacity_asset_status,
                  status_reason=$17,
                  updated_by_user_id=$18::uuid,
                  updated_at=now()
            WHERE id=$1::uuid`,
          [
            assetId,
            carrierPartyId,
            ownerPartyId,
            ownerName,
            patch.assetKind ?? before.assetKind,
            patch.identifier ?? before.identifier,
            patch.plate !== undefined ? patch.plate : before.plate,
            patch.vehicleType ?? before.vehicleType,
            patch.bodyType ?? before.bodyType,
            patch.capacityWeightKg ?? before.capacityWeightKg,
            patch.capacityVolumeM3 !== undefined ? patch.capacityVolumeM3 : before.capacityVolumeM3,
            maxLengthM,
            maxWidthM,
            maxHeightM,
            patch.trackingAvailable ?? before.trackingAvailable,
            assetStatus,
            statusReason,
            context.userId,
          ],
        );

        const after = await this.requireAsset(client, assetId);
        const changeType =
          before.status !== after.status || before.statusReason !== after.statusReason
            ? 'status_changed'
            : 'updated';
        await this.writeAudit(client, context.tenantId, context.userId, changeType, before, after);
        return after;
      });
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async audit(id: string): Promise<readonly CapacityAssetAuditEntry[]> {
    const assetId = requireUuid(id);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireAsset(client, assetId);
      const result = await client.query<CapacityAssetAuditRow>(
        `SELECT id::text AS id, change_type, actor_user_id::text AS actor_user_id,
                before_snapshot, after_snapshot, created_at
           FROM capacity_asset_audit
          WHERE asset_id=$1::uuid
          ORDER BY created_at, id`,
        [assetId],
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

  private async requireAsset(client: TenantQueryClient, id: string): Promise<CapacityAsset> {
    const result = await client.query<CapacityAssetRow>(`${assetSelect} WHERE id=$1::uuid`, [id]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Capacity asset not found');
    return mapAsset(row);
  }

  private async validateCarrier(client: TenantQueryClient, partyId: string | null): Promise<void> {
    if (!partyId) return;
    const result = await client.query(
      `SELECT 1
         FROM business_parties p
         JOIN business_party_roles r ON r.tenant_id=p.tenant_id AND r.party_id=p.id
        WHERE p.id=$1::uuid AND p.status='active' AND r.role='carrier'
        LIMIT 1`,
      [partyId],
    );
    if (result.rowCount !== 1) {
      throw new BadRequestException(
        'carrierPartyId must reference an active carrier in the current tenant',
      );
    }
  }

  private async validateOwner(client: TenantQueryClient, partyId: string | null): Promise<void> {
    if (!partyId) return;
    const result = await client.query(
      `SELECT 1 FROM business_parties WHERE id=$1::uuid AND status='active' LIMIT 1`,
      [partyId],
    );
    if (result.rowCount !== 1) {
      throw new BadRequestException(
        'ownerPartyId must reference an active business party in the current tenant',
      );
    }
  }

  private async writeAudit(
    client: TenantQueryClient,
    tenantId: string,
    actorUserId: string,
    changeType: 'created' | 'updated' | 'status_changed',
    before: CapacityAsset | null,
    after: CapacityAsset,
  ): Promise<void> {
    await client.query(
      `INSERT INTO capacity_asset_audit (
         tenant_id, asset_id, actor_user_id, change_type, before_snapshot, after_snapshot
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

  private rethrowConstraint(error: unknown): never {
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if (code === '23505') {
      throw new ConflictException(
        'Asset identifier or plate is already registered for this tenant',
      );
    }
    if (code === '23503' || code === '23514') {
      throw new BadRequestException('Capacity asset data violates a business constraint');
    }
    throw error;
  }
}

const assetSelect = `SELECT id::text AS id, carrier_party_id::text AS carrier_party_id,
  owner_party_id::text AS owner_party_id, owner_name, asset_kind::text AS asset_kind,
  identifier, plate, vehicle_type, body_type, capacity_weight_kg::text AS capacity_weight_kg,
  capacity_volume_m3::text AS capacity_volume_m3, max_length_m::text AS max_length_m,
  max_width_m::text AS max_width_m, max_height_m::text AS max_height_m,
  tracking_available, status::text AS status, status_reason, created_at, updated_at
  FROM capacity_assets`;

function mapAsset(row: CapacityAssetRow): CapacityAsset {
  return {
    id: row.id,
    carrierPartyId: row.carrier_party_id,
    ownerPartyId: row.owner_party_id,
    ownerName: row.owner_name,
    assetKind: row.asset_kind,
    identifier: row.identifier,
    plate: row.plate,
    vehicleType: row.vehicle_type,
    bodyType: row.body_type,
    capacityWeightKg: Number(row.capacity_weight_kg),
    capacityVolumeM3: numberOrNull(row.capacity_volume_m3),
    maxLengthM: numberOrNull(row.max_length_m),
    maxWidthM: numberOrNull(row.max_width_m),
    maxHeightM: numberOrNull(row.max_height_m),
    trackingAvailable: row.tracking_available,
    status: row.status,
    statusReason: row.status_reason,
    eligibleForMatching: row.status === 'active',
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function snapshot(asset: CapacityAsset): CapacityAssetSnapshot {
  return {
    id: asset.id,
    carrierPartyId: asset.carrierPartyId,
    ownerPartyId: asset.ownerPartyId,
    ownerName: asset.ownerName,
    assetKind: asset.assetKind,
    identifier: asset.identifier,
    plate: asset.plate,
    vehicleType: asset.vehicleType,
    bodyType: asset.bodyType,
    capacityWeightKg: asset.capacityWeightKg,
    capacityVolumeM3: asset.capacityVolumeM3,
    maxLengthM: asset.maxLengthM,
    maxWidthM: asset.maxWidthM,
    maxHeightM: asset.maxHeightM,
    trackingAvailable: asset.trackingAvailable,
    status: asset.status,
    statusReason: asset.statusReason,
  };
}

function numberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function requireUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BadRequestException('id must be a valid UUID');
  }
  return value;
}
