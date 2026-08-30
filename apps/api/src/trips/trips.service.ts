import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  parseTripAssetCreate,
  parseTripCreate,
  parseTripDriverCreate,
  parseTripReason,
  parseTripRequestLink,
  parseTripStatus,
  parseTripStopCreate,
} from './trips.validation.js';

interface ContractRow {
  readonly id: string;
  readonly transport_request_id: string;
  readonly capacity_assignment_id: string;
  readonly driver_id: string;
  readonly vehicle_id: string;
  readonly carrier_party_id: string;
  readonly status: string;
}

interface TripRow {
  readonly id: string;
  readonly code: string;
  readonly status: 'planned' | 'ready' | 'in_transit' | 'completed' | 'cancelled';
  readonly planned_start_at: Date;
  readonly planned_end_at: Date | null;
  readonly actual_start_at: Date | null;
  readonly actual_end_at: Date | null;
  readonly origin_location_id: string | null;
  readonly destination_location_id: string | null;
  readonly notes: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface Trip {
  readonly id: string;
  readonly code: string;
  readonly status: TripRow['status'];
  readonly plannedStartAt: string;
  readonly plannedEndAt: string | null;
  readonly actualStartAt: string | null;
  readonly actualEndAt: string | null;
  readonly originLocationId: string | null;
  readonly destinationLocationId: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

@Injectable()
export class TripsService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async list(): Promise<readonly Trip[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<TripRow>(
        `SELECT id::text AS id,code,status::text AS status,planned_start_at,planned_end_at,
                actual_start_at,actual_end_at,origin_location_id::text,destination_location_id::text,
                notes,created_at,updated_at
           FROM trips
          ORDER BY planned_start_at DESC,created_at DESC`,
      );
      return result.rows.map(mapTrip);
    });
  }

  async get(tripId: string): Promise<Trip> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) =>
      mapTrip(await this.requireTrip(client, tripId, false)),
    );
  }

  async create(input: unknown): Promise<Trip> {
    const trip = parseTripCreate(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const contracts = await this.requireConfirmedContracts(client, trip.contractIds);
      this.requireCompatibleCapacity(contracts);

      try {
        const created = await client.query<{ id: string }>(
          `INSERT INTO trips (
             tenant_id,code,status,planned_start_at,planned_end_at,origin_location_id,
             destination_location_id,notes,created_by_user_id,updated_by_user_id
           ) VALUES ($1::uuid,$2,'planned',$3::timestamptz,$4::timestamptz,$5::uuid,$6::uuid,$7,$8::uuid,$8::uuid)
           RETURNING id::text AS id`,
          [
            context.tenantId,
            trip.code,
            trip.plannedStartAt,
            trip.plannedEndAt,
            trip.originLocationId,
            trip.destinationLocationId,
            trip.notes,
            context.userId,
          ],
        );
        const tripId = created.rows[0]?.id;
        if (!tripId) throw new ConflictException('Trip could not be created');

        for (const [index, contract] of contracts.entries()) {
          await this.insertRequestLink(client, tripId, contract, index + 1);
        }
        await this.copyRequestStops(client, tripId, contracts, context.userId);

        const primary = contracts[0];
        if (!primary) throw new ConflictException('At least one confirmed contract is required');
        await client.query(
          `INSERT INTO trip_drivers (
             tenant_id,trip_id,driver_id,role,starts_at,created_by_user_id,updated_by_user_id
           ) VALUES ($1::uuid,$2::uuid,$3::uuid,'primary',$4::timestamptz,$5::uuid,$5::uuid)`,
          [context.tenantId, tripId, primary.driver_id, trip.plannedStartAt, context.userId],
        );
        await client.query(
          `INSERT INTO trip_assets (
             tenant_id,trip_id,asset_id,role,starts_at,created_by_user_id,updated_by_user_id
           ) VALUES ($1::uuid,$2::uuid,$3::uuid,'vehicle',$4::timestamptz,$5::uuid,$5::uuid)`,
          [context.tenantId, tripId, primary.vehicle_id, trip.plannedStartAt, context.userId],
        );
        await client.query(
          `INSERT INTO trip_status_history (tenant_id,trip_id,from_status,to_status,actor_user_id)
           VALUES ($1::uuid,$2::uuid,NULL,'planned',$3::uuid)`,
          [context.tenantId, tripId, context.userId],
        );

        return mapTrip(await this.requireTrip(client, tripId, false));
      } catch (error) {
        if (hasPgCode(error, '23505')) {
          throw new ConflictException('Trip code or active trip association already exists');
        }
        throw error;
      }
    });
  }

  async setStatus(tripId: string, input: unknown): Promise<Trip> {
    const transition = parseTripStatus(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const current = await this.requireTrip(client, tripId, true);
      this.requireTransition(current.status, transition.status);

      await client.query(
        `UPDATE trips
            SET status=$1,
                actual_start_at=CASE WHEN $1='in_transit' AND actual_start_at IS NULL THEN now() ELSE actual_start_at END,
                actual_end_at=CASE WHEN $1='completed' AND actual_end_at IS NULL THEN now() ELSE actual_end_at END,
                updated_by_user_id=$2::uuid,
                updated_at=now()
          WHERE id=$3::uuid`,
        [transition.status, context.userId, current.id],
      );
      await client.query(
        `INSERT INTO trip_status_history (
           tenant_id,trip_id,from_status,to_status,actor_user_id,reason
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6)`,
        [
          context.tenantId,
          current.id,
          current.status,
          transition.status,
          context.userId,
          transition.reason,
        ],
      );
      return mapTrip(await this.requireTrip(client, current.id, false));
    });
  }

  async listRequests(tripId: string): Promise<readonly Record<string, unknown>[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireTrip(client, tripId, false);
      const result = await client.query<Record<string, unknown>>(
        `SELECT transport_request_id::text AS "transportRequestId",
                transport_contract_id::text AS "transportContractId",
                sequence,removed_at AS "removedAt",remove_reason AS "removeReason",created_at AS "createdAt"
           FROM trip_transport_requests
          WHERE trip_id=$1::uuid
          ORDER BY sequence,created_at`,
        [trip.id],
      );
      return result.rows;
    });
  }

  async addRequest(tripId: string, transportRequestId: string, input: unknown): Promise<void> {
    const link = parseTripRequestLink(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireMutableTrip(client, tripId);
      const contracts = await this.requireConfirmedContracts(client, [link.contractId]);
      const contract = contracts[0];
      if (!contract || contract.transport_request_id !== transportRequestId) {
        throw new ConflictException('Contract does not belong to the requested transport request');
      }
      const existing = await this.loadActiveTripCapacity(client, trip.id);
      if (
        existing &&
        (existing.driver_id !== contract.driver_id || existing.asset_id !== contract.vehicle_id)
      ) {
        throw new ConflictException('Contract capacity is incompatible with the trip capacity');
      }
      await this.insertRequestLink(client, trip.id, contract, link.sequence);
    });
  }

  async removeRequest(tripId: string, transportRequestId: string, input: unknown): Promise<void> {
    const reason = parseTripReason(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireMutableTrip(client, tripId);
      const result = await client.query(
        `UPDATE trip_transport_requests
            SET removed_at=now(),removed_by_user_id=$1::uuid,remove_reason=$2
          WHERE trip_id=$3::uuid AND transport_request_id=$4::uuid AND removed_at IS NULL`,
        [context.userId, reason, trip.id, transportRequestId],
      );
      if (result.rowCount === 0) throw new NotFoundException('Active trip request link not found');
    });
  }

  async listStops(tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.listSubresource(tripId, 'trip_stops', 'sequence,created_at');
  }

  async addStop(tripId: string, input: unknown): Promise<void> {
    const stop = parseTripStopCreate(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireMutableTrip(client, tripId);
      await client.query(
        `INSERT INTO trip_stops (
           tenant_id,trip_id,sequence,type,location_id,source_transport_request_id,
           source_transport_request_stop_id,planned_arrival_at,planned_departure_at,instructions,
           created_by_user_id,updated_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::uuid,$7::uuid,$8::timestamptz,$9::timestamptz,$10,$11::uuid,$11::uuid)`,
        [
          context.tenantId,
          trip.id,
          stop.sequence,
          stop.type,
          stop.locationId,
          stop.sourceTransportRequestId,
          stop.sourceTransportRequestStopId,
          stop.plannedArrivalAt,
          stop.plannedDepartureAt,
          stop.instructions,
          context.userId,
        ],
      );
    });
  }

  async listDrivers(tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.listSubresource(tripId, 'trip_drivers', 'starts_at,created_at');
  }

  async addDriver(tripId: string, input: unknown): Promise<void> {
    const driver = parseTripDriverCreate(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireMutableTrip(client, tripId);
      await client.query(
        `INSERT INTO trip_drivers (
           tenant_id,trip_id,driver_id,role,starts_at,created_by_user_id,updated_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,coalesce($5::timestamptz,$6::timestamptz),$7::uuid,$7::uuid)`,
        [
          context.tenantId,
          trip.id,
          driver.driverId,
          driver.role,
          driver.startsAt,
          trip.planned_start_at,
          context.userId,
        ],
      );
    });
  }

  async listAssets(tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.listSubresource(tripId, 'trip_assets', 'starts_at,created_at');
  }

  async addAsset(tripId: string, input: unknown): Promise<void> {
    const asset = parseTripAssetCreate(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireMutableTrip(client, tripId);
      await client.query(
        `INSERT INTO trip_assets (
           tenant_id,trip_id,asset_id,role,starts_at,created_by_user_id,updated_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,coalesce($5::timestamptz,$6::timestamptz),$7::uuid,$7::uuid)`,
        [
          context.tenantId,
          trip.id,
          asset.assetId,
          asset.role,
          asset.startsAt,
          trip.planned_start_at,
          context.userId,
        ],
      );
    });
  }

  async listStatusHistory(tripId: string): Promise<readonly Record<string, unknown>[]> {
    return this.listSubresource(tripId, 'trip_status_history', 'created_at');
  }

  private async requireTrip(
    client: TenantQueryClient,
    tripId: string,
    forUpdate: boolean,
  ): Promise<TripRow> {
    const result = await client.query<TripRow>(
      `SELECT id::text AS id,code,status::text AS status,planned_start_at,planned_end_at,
              actual_start_at,actual_end_at,origin_location_id::text,destination_location_id::text,
              notes,created_at,updated_at
         FROM trips
        WHERE id=$1::uuid${forUpdate ? ' FOR UPDATE' : ''}`,
      [tripId],
    );
    const trip = result.rows[0];
    if (!trip) throw new NotFoundException('Trip not found in current tenant');
    return trip;
  }

  private async requireMutableTrip(client: TenantQueryClient, tripId: string): Promise<TripRow> {
    const trip = await this.requireTrip(client, tripId, true);
    if (trip.status !== 'planned' && trip.status !== 'ready') {
      throw new ConflictException(`Trip cannot be changed while status is ${trip.status}`);
    }
    return trip;
  }

  private async requireConfirmedContracts(
    client: TenantQueryClient,
    contractIds: readonly string[],
  ): Promise<ContractRow[]> {
    const result = await client.query<ContractRow>(
      `SELECT id::text AS id,transport_request_id::text AS transport_request_id,
              capacity_assignment_id::text AS capacity_assignment_id,driver_id::text AS driver_id,
              vehicle_id::text AS vehicle_id,carrier_party_id::text AS carrier_party_id,status::text AS status
         FROM transport_contracts
        WHERE id=ANY($1::uuid[])
        ORDER BY array_position($1::uuid[],id)`,
      [contractIds],
    );
    if (result.rows.length !== contractIds.length) {
      throw new NotFoundException('One or more transport contracts were not found in current tenant');
    }
    if (result.rows.some((contract) => contract.status !== 'confirmed')) {
      throw new ConflictException('Only confirmed transport contracts can create or join a trip');
    }
    return result.rows;
  }

  private requireCompatibleCapacity(contracts: readonly ContractRow[]): void {
    const first = contracts[0];
    if (!first) throw new ConflictException('At least one confirmed contract is required');
    const incompatible = contracts.some(
      (contract) =>
        contract.capacity_assignment_id !== first.capacity_assignment_id ||
        contract.driver_id !== first.driver_id ||
        contract.vehicle_id !== first.vehicle_id ||
        contract.carrier_party_id !== first.carrier_party_id,
    );
    if (incompatible) {
      throw new ConflictException(
        'All contracts in a trip must share the same capacity assignment, driver, vehicle and carrier',
      );
    }
  }

  private async insertRequestLink(
    client: TenantQueryClient,
    tripId: string,
    contract: ContractRow,
    sequence: number,
  ): Promise<void> {
    await client.query(
      `INSERT INTO trip_transport_requests (
         tenant_id,trip_id,transport_request_id,transport_contract_id,sequence
       ) VALUES (current_setting('app.tenant_id')::uuid,$1::uuid,$2::uuid,$3::uuid,$4)`,
      [tripId, contract.transport_request_id, contract.id, sequence],
    );
  }

  private async copyRequestStops(
    client: TenantQueryClient,
    tripId: string,
    contracts: readonly ContractRow[],
    userId: string,
  ): Promise<void> {
    let sequence = 1;
    for (const contract of contracts) {
      const stops = await client.query<{
        id: string;
        transport_request_id: string;
        type: string;
        window_start_at: Date;
        window_end_at: Date;
        instructions: string | null;
      }>(
        `SELECT id::text AS id,transport_request_id::text AS transport_request_id,type::text AS type,
                window_start_at,window_end_at,instructions
           FROM transport_request_stops
          WHERE transport_request_id=$1::uuid
          ORDER BY sequence`,
        [contract.transport_request_id],
      );
      for (const stop of stops.rows) {
        await client.query(
          `INSERT INTO trip_stops (
             tenant_id,trip_id,sequence,type,source_transport_request_id,source_transport_request_stop_id,
             planned_arrival_at,planned_departure_at,instructions,created_by_user_id,updated_by_user_id
           ) VALUES (current_setting('app.tenant_id')::uuid,$1::uuid,$2,$3,$4::uuid,$5::uuid,$6,$7,$8,$9::uuid,$9::uuid)`,
          [
            tripId,
            sequence++,
            stop.type,
            stop.transport_request_id,
            stop.id,
            stop.window_start_at,
            stop.window_end_at,
            stop.instructions,
            userId,
          ],
        );
      }
    }
  }

  private async listSubresource(
    tripId: string,
    table: 'trip_stops' | 'trip_drivers' | 'trip_assets' | 'trip_status_history',
    order: string,
  ): Promise<readonly Record<string, unknown>[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireTrip(client, tripId, false);
      const result = await client.query<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE trip_id=$1::uuid ORDER BY ${order}`,
        [trip.id],
      );
      return result.rows;
    });
  }

  private async loadActiveTripCapacity(
    client: TenantQueryClient,
    tripId: string,
  ): Promise<{ driver_id: string; asset_id: string } | null> {
    const result = await client.query<{ driver_id: string; asset_id: string }>(
      `SELECT d.driver_id::text AS driver_id,a.asset_id::text AS asset_id
         FROM trip_drivers d
         JOIN trip_assets a ON a.trip_id=d.trip_id AND a.tenant_id=d.tenant_id
        WHERE d.trip_id=$1::uuid AND d.role='primary' AND d.ends_at IS NULL
          AND a.role='vehicle' AND a.ends_at IS NULL
        LIMIT 1`,
      [tripId],
    );
    return result.rows[0] ?? null;
  }

  private requireTransition(from: TripRow['status'], to: string): void {
    const allowed: Record<TripRow['status'], readonly string[]> = {
      planned: ['ready', 'cancelled'],
      ready: ['in_transit', 'cancelled'],
      in_transit: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };
    if (!allowed[from].includes(to)) {
      throw new ConflictException(`Trip transition ${from} -> ${to} is not allowed`);
    }
  }
}

function mapTrip(row: TripRow): Trip {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    plannedStartAt: row.planned_start_at.toISOString(),
    plannedEndAt: row.planned_end_at?.toISOString() ?? null,
    actualStartAt: row.actual_start_at?.toISOString() ?? null,
    actualEndAt: row.actual_end_at?.toISOString() ?? null,
    originLocationId: row.origin_location_id,
    destinationLocationId: row.destination_location_id,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function hasPgCode(error: unknown, code: string): boolean {
  return Boolean(
    error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === code,
  );
}
