import { Injectable, NotFoundException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  evaluateCapacityCompatibility,
  type CapacityMismatchReason,
  type CargoMatchingRequirements,
} from './capacity-matching.js';

interface CargoRequirementRow {
  readonly transport_request_id: string;
  readonly total_weight_kg: string;
  readonly cubage_m3: string | null;
  readonly max_length_m: string | null;
  readonly max_width_m: string | null;
  readonly max_height_m: string | null;
  readonly tracking_required: boolean;
  readonly vehicle_type: string;
  readonly body_type: string;
}

interface CandidateRow {
  readonly assignment_id: string;
  readonly driver_id: string;
  readonly driver_name: string;
  readonly driver_registration_status: string;
  readonly driver_operational_status: string;
  readonly vehicle_id: string;
  readonly vehicle_identifier: string;
  readonly vehicle_plate: string | null;
  readonly vehicle_status: string;
  readonly vehicle_type: string;
  readonly body_type: string;
  readonly capacity_weight_kg: string;
  readonly capacity_volume_m3: string | null;
  readonly max_length_m: string | null;
  readonly max_width_m: string | null;
  readonly max_height_m: string | null;
  readonly tracking_available: boolean;
  readonly carrier_party_id: string;
  readonly carrier_name: string;
  readonly assignment_starts_at: Date;
}

export interface CapacityMatchCandidate {
  readonly assignmentId: string;
  readonly driver: {
    readonly id: string;
    readonly name: string;
  };
  readonly vehicle: {
    readonly id: string;
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
  };
  readonly carrier: {
    readonly id: string;
    readonly name: string;
  };
  readonly assignmentStartsAt: string;
  readonly compatible: boolean;
  readonly reasons: readonly CapacityMismatchReason[];
}

export interface CapacityMatchingResult {
  readonly transportRequestId: string;
  readonly requirements: CargoMatchingRequirements;
  readonly compatible: readonly CapacityMatchCandidate[];
  readonly incompatible: readonly CapacityMatchCandidate[];
  readonly summary: {
    readonly evaluated: number;
    readonly compatible: number;
    readonly incompatible: number;
  };
}

@Injectable()
export class CapacityMatchingService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async search(requestId: string): Promise<CapacityMatchingResult> {
    const transportRequestId = requireUuid(requestId, 'requestId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, (client) =>
      this.evaluateForRequest(transportRequestId, client),
    );
  }

  async evaluateForRequest(
    transportRequestId: string,
    client: TenantQueryClient,
  ): Promise<CapacityMatchingResult> {
    const cargoResult = await client.query<CargoRequirementRow>(
      `SELECT cp.transport_request_id::text AS transport_request_id,
              cp.total_weight_kg::text AS total_weight_kg,
              cp.cubage_m3::text AS cubage_m3,
              cp.max_length_m::text AS max_length_m,
              cp.max_width_m::text AS max_width_m,
              cp.max_height_m::text AS max_height_m,
              cp.tracking_required,
              cp.vehicle_type,
              cp.body_type
         FROM transport_requests tr
         JOIN transport_request_cargo_profiles cp
           ON cp.tenant_id=tr.tenant_id AND cp.transport_request_id=tr.id
        WHERE tr.id=$1::uuid`,
      [transportRequestId],
    );
    const cargoRow = cargoResult.rows[0];
    if (!cargoRow) {
      throw new NotFoundException(
        'Transport request with cargo profile not found in current tenant',
      );
    }

    const requirements = mapRequirements(cargoRow);
    const candidates = await client.query<CandidateRow>(
      `SELECT a.id::text AS assignment_id,
              d.id::text AS driver_id,
              d.full_name AS driver_name,
              d.registration_status::text AS driver_registration_status,
              d.operational_status::text AS driver_operational_status,
              v.id::text AS vehicle_id,
              v.identifier AS vehicle_identifier,
              v.plate AS vehicle_plate,
              v.status::text AS vehicle_status,
              v.vehicle_type,
              v.body_type,
              v.capacity_weight_kg::text AS capacity_weight_kg,
              v.capacity_volume_m3::text AS capacity_volume_m3,
              v.max_length_m::text AS max_length_m,
              v.max_width_m::text AS max_width_m,
              v.max_height_m::text AS max_height_m,
              v.tracking_available,
              p.id::text AS carrier_party_id,
              p.legal_name AS carrier_name,
              a.starts_at AS assignment_starts_at
         FROM capacity_assignments a
         JOIN drivers d ON d.tenant_id=a.tenant_id AND d.id=a.driver_id
         JOIN capacity_assets v ON v.tenant_id=a.tenant_id AND v.id=a.vehicle_id
         JOIN business_parties p ON p.tenant_id=a.tenant_id AND p.id=a.carrier_party_id
        WHERE a.status='active'
        ORDER BY d.full_name,v.identifier,a.starts_at`,
    );

    const evaluated = candidates.rows.map((row) => evaluateCandidate(requirements, row));
    const compatible = evaluated.filter((candidate) => candidate.compatible);
    const incompatible = evaluated.filter((candidate) => !candidate.compatible);

    return {
      transportRequestId,
      requirements,
      compatible,
      incompatible,
      summary: {
        evaluated: evaluated.length,
        compatible: compatible.length,
        incompatible: incompatible.length,
      },
    };
  }
}

function mapRequirements(row: CargoRequirementRow): CargoMatchingRequirements {
  return {
    totalWeightKg: Number(row.total_weight_kg),
    cubageM3: nullableNumber(row.cubage_m3),
    maxLengthM: nullableNumber(row.max_length_m),
    maxWidthM: nullableNumber(row.max_width_m),
    maxHeightM: nullableNumber(row.max_height_m),
    trackingRequired: row.tracking_required,
    vehicleType: row.vehicle_type,
    bodyType: row.body_type,
  };
}

function evaluateCandidate(
  requirements: CargoMatchingRequirements,
  row: CandidateRow,
): CapacityMatchCandidate {
  const evaluation = evaluateCapacityCompatibility(requirements, {
    driverRegistrationStatus: row.driver_registration_status,
    driverOperationalStatus: row.driver_operational_status,
    vehicleStatus: row.vehicle_status,
    vehicleType: row.vehicle_type,
    bodyType: row.body_type,
    capacityWeightKg: Number(row.capacity_weight_kg),
    capacityVolumeM3: nullableNumber(row.capacity_volume_m3),
    maxLengthM: nullableNumber(row.max_length_m),
    maxWidthM: nullableNumber(row.max_width_m),
    maxHeightM: nullableNumber(row.max_height_m),
    trackingAvailable: row.tracking_available,
  });

  return {
    assignmentId: row.assignment_id,
    driver: { id: row.driver_id, name: row.driver_name },
    vehicle: {
      id: row.vehicle_id,
      identifier: row.vehicle_identifier,
      plate: row.vehicle_plate,
      vehicleType: row.vehicle_type,
      bodyType: row.body_type,
      capacityWeightKg: Number(row.capacity_weight_kg),
      capacityVolumeM3: nullableNumber(row.capacity_volume_m3),
      maxLengthM: nullableNumber(row.max_length_m),
      maxWidthM: nullableNumber(row.max_width_m),
      maxHeightM: nullableNumber(row.max_height_m),
      trackingAvailable: row.tracking_available,
    },
    carrier: { id: row.carrier_party_id, name: row.carrier_name },
    assignmentStartsAt: row.assignment_starts_at.toISOString(),
    compatible: evaluation.compatible,
    reasons: evaluation.reasons,
  };
}

function nullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}
