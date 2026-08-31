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
  parseEventCreate,
  parseItemCreate,
  parseItemPatch,
  parseLaneCreate,
  parseLanePatch,
  parsePackageCreate,
  parsePackagePatch,
  parseReferenceCreate,
  parseReferencePatch,
  parseRequirementCreate,
  parseRequirementPatch,
  requireWave0019Uuid,
  type MutablePatch,
} from './freight-normalization.validation.js';

export type FreightNormalizedRecord = Readonly<Record<string, unknown>>;

const itemColumns: Readonly<Record<string, string>> = {
  sequence: 'sequence',
  commodityId: 'commodity_id',
  cargoTypeId: 'cargo_type_id',
  sku: 'sku',
  description: 'description',
  quantity: 'quantity',
  unitOfMeasureId: 'unit_of_measure_id',
  totalWeightKg: 'total_weight_kg',
  totalVolumeM3: 'total_volume_m3',
  hazardous: 'hazardous',
  minTemperatureC: 'min_temperature_c',
  maxTemperatureC: 'max_temperature_c',
  stackable: 'stackable',
  notes: 'notes',
};
const packageColumns: Readonly<Record<string, string>> = {
  itemId: 'item_id',
  sequence: 'sequence',
  packageTypeId: 'package_type_id',
  quantity: 'quantity',
  weightKg: 'weight_kg',
  lengthM: 'length_m',
  widthM: 'width_m',
  heightM: 'height_m',
  stackable: 'stackable',
  label: 'label',
  barcode: 'barcode',
  notes: 'notes',
};
const requirementColumns: Readonly<Record<string, string>> = {
  code: 'code',
  requirementType: 'requirement_type',
  vehicleTypeId: 'vehicle_type_id',
  bodyTypeId: 'body_type_id',
  required: 'required',
  valueText: 'value_text',
  valueNumeric: 'value_numeric',
  valueBoolean: 'value_boolean',
  metadata: 'metadata',
  notes: 'notes',
};
const referenceColumns: Readonly<Record<string, string>> = {
  referenceType: 'reference_type',
  value: 'value',
  issuerPartyId: 'issuer_party_id',
  metadata: 'metadata',
};
const laneColumns: Readonly<Record<string, string>> = {
  code: 'code',
  name: 'name',
  originCityId: 'origin_city_id',
  destinationCityId: 'destination_city_id',
  originRadiusKm: 'origin_radius_km',
  destinationRadiusKm: 'destination_radius_km',
  distanceKm: 'distance_km',
  typicalTransitHours: 'typical_transit_hours',
  isActive: 'is_active',
};

@Injectable()
export class FreightNormalizationService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  listItems(requestId: string): Promise<readonly FreightNormalizedRecord[]> {
    return this.listRequestChildren(
      requestId,
      `SELECT i.*,
              c.name AS commodity_name,
              ct.name AS cargo_type_name,
              u.code AS unit_of_measure_code
         FROM transport_request_items i
         LEFT JOIN commodities c ON c.tenant_id=i.tenant_id AND c.id=i.commodity_id
         LEFT JOIN cargo_types ct ON ct.tenant_id=i.tenant_id AND ct.id=i.cargo_type_id
         LEFT JOIN units_of_measure u ON u.id=i.unit_of_measure_id
        WHERE i.transport_request_id=$1::uuid
        ORDER BY i.sequence, i.created_at, i.id`,
    );
  }

  createItem(requestId: string, input: unknown): Promise<FreightNormalizedRecord> {
    const data = parseItemCreate(input);
    return this.createRequestChild(requestId, 'transport_request_items', itemColumns, data, 'item');
  }

  updateItem(requestId: string, itemId: string, input: unknown): Promise<FreightNormalizedRecord> {
    return this.updateRequestChild(
      requestId,
      itemId,
      'transport_request_items',
      itemColumns,
      parseItemPatch(input),
      'item',
    );
  }

  deleteItem(requestId: string, itemId: string): Promise<void> {
    return this.deleteRequestChild(requestId, itemId, 'transport_request_items', 'item');
  }

  listPackages(requestId: string): Promise<readonly FreightNormalizedRecord[]> {
    return this.listRequestChildren(
      requestId,
      `SELECT p.*, pt.name AS package_type_name
         FROM transport_request_packages p
         LEFT JOIN package_types pt ON pt.tenant_id=p.tenant_id AND pt.id=p.package_type_id
        WHERE p.transport_request_id=$1::uuid
        ORDER BY p.sequence, p.created_at, p.id`,
    );
  }

  createPackage(requestId: string, input: unknown): Promise<FreightNormalizedRecord> {
    return this.createRequestChild(
      requestId,
      'transport_request_packages',
      packageColumns,
      parsePackageCreate(input),
      'package',
    );
  }

  updatePackage(
    requestId: string,
    packageId: string,
    input: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.updateRequestChild(
      requestId,
      packageId,
      'transport_request_packages',
      packageColumns,
      parsePackagePatch(input),
      'package',
    );
  }

  deletePackage(requestId: string, packageId: string): Promise<void> {
    return this.deleteRequestChild(requestId, packageId, 'transport_request_packages', 'package');
  }

  listRequirements(requestId: string): Promise<readonly FreightNormalizedRecord[]> {
    return this.listRequestChildren(
      requestId,
      `SELECT r.*,
              vt.name AS vehicle_type_name,
              bt.name AS body_type_name
         FROM transport_request_requirements r
         LEFT JOIN vehicle_types vt ON vt.tenant_id=r.tenant_id AND vt.id=r.vehicle_type_id
         LEFT JOIN body_types bt ON bt.tenant_id=r.tenant_id AND bt.id=r.body_type_id
        WHERE r.transport_request_id=$1::uuid
        ORDER BY r.required DESC, r.code, r.created_at, r.id`,
    );
  }

  createRequirement(requestId: string, input: unknown): Promise<FreightNormalizedRecord> {
    return this.createRequestChild(
      requestId,
      'transport_request_requirements',
      requirementColumns,
      parseRequirementCreate(input),
      'requirement',
    );
  }

  updateRequirement(
    requestId: string,
    requirementId: string,
    input: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.updateRequestChild(
      requestId,
      requirementId,
      'transport_request_requirements',
      requirementColumns,
      parseRequirementPatch(input),
      'requirement',
    );
  }

  deleteRequirement(requestId: string, requirementId: string): Promise<void> {
    return this.deleteRequestChild(
      requestId,
      requirementId,
      'transport_request_requirements',
      'requirement',
    );
  }

  listReferences(requestId: string): Promise<readonly FreightNormalizedRecord[]> {
    return this.listRequestChildren(
      requestId,
      `SELECT r.*, p.legal_name AS issuer_party_name
         FROM transport_request_references r
         LEFT JOIN business_parties p ON p.tenant_id=r.tenant_id AND p.id=r.issuer_party_id
        WHERE r.transport_request_id=$1::uuid
        ORDER BY r.reference_type, r.created_at, r.id`,
    );
  }

  createReference(requestId: string, input: unknown): Promise<FreightNormalizedRecord> {
    return this.createRequestChild(
      requestId,
      'transport_request_references',
      referenceColumns,
      parseReferenceCreate(input),
      'reference',
    );
  }

  updateReference(
    requestId: string,
    referenceId: string,
    input: unknown,
  ): Promise<FreightNormalizedRecord> {
    return this.updateRequestChild(
      requestId,
      referenceId,
      'transport_request_references',
      referenceColumns,
      parseReferencePatch(input),
      'reference',
    );
  }

  deleteReference(requestId: string, referenceId: string): Promise<void> {
    return this.deleteRequestChild(
      requestId,
      referenceId,
      'transport_request_references',
      'reference',
    );
  }

  listStatusHistory(requestId: string): Promise<readonly FreightNormalizedRecord[]> {
    return this.listRequestChildren(
      requestId,
      `SELECT h.*
         FROM transport_request_status_history h
        WHERE h.transport_request_id=$1::uuid
        ORDER BY h.created_at DESC, h.id DESC`,
    );
  }

  listEvents(requestId: string): Promise<readonly FreightNormalizedRecord[]> {
    return this.listRequestChildren(
      requestId,
      `SELECT e.*
         FROM transport_request_events e
        WHERE e.transport_request_id=$1::uuid
        ORDER BY e.occurred_at DESC, e.created_at DESC, e.id DESC`,
    );
  }

  createEvent(requestId: string, input: unknown): Promise<FreightNormalizedRecord> {
    const requestUuid = requireWave0019Uuid(requestId, 'requestId');
    const data = parseEventCreate(input);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        await this.requireRequest(client, requestUuid);
        const result = await client.query<FreightNormalizedRecord>(
          `INSERT INTO transport_request_events (
             tenant_id, transport_request_id, event_type, source, actor_user_id, correlation_id, payload
           ) VALUES ($1::uuid,$2::uuid,$3,'user',$4::uuid,$5::uuid,$6::jsonb)
           RETURNING *`,
          [
            context.tenantId,
            requestUuid,
            data.eventType,
            context.userId,
            data.correlationId,
            JSON.stringify(data.payload),
          ],
        );
        return result.rows[0]!;
      }),
    );
  }

  listLanes(): Promise<readonly FreightNormalizedRecord[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<FreightNormalizedRecord>(
        `SELECT l.*,
                oc.name AS origin_city_name,
                os.code AS origin_state_code,
                dc.name AS destination_city_name,
                ds.code AS destination_state_code
           FROM freight_lanes l
           JOIN cities oc ON oc.id=l.origin_city_id
           JOIN states os ON os.id=oc.state_id
           JOIN cities dc ON dc.id=l.destination_city_id
           JOIN states ds ON ds.id=dc.state_id
          ORDER BY l.is_active DESC, l.name, l.id`,
      );
      return result.rows;
    });
  }

  createLane(input: unknown): Promise<FreightNormalizedRecord> {
    const data = parseLaneCreate(input);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        const row = await this.insertMutable(
          client,
          'freight_lanes',
          laneColumns,
          data,
          context.tenantId,
          context.userId,
          undefined,
        );
        return this.fetchById(client, 'freight_lanes', String(row.id), 'freight lane');
      }),
    );
  }

  updateLane(laneId: string, input: unknown): Promise<FreightNormalizedRecord> {
    const id = requireWave0019Uuid(laneId, 'laneId');
    const patch = parseLanePatch(input);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        const before = await this.fetchById(client, 'freight_lanes', id, 'freight lane');
        const origin = patch.originCityId ?? before.origin_city_id;
        const destination = patch.destinationCityId ?? before.destination_city_id;
        if (origin === destination) {
          throw new BadRequestException('originCityId and destinationCityId must be different');
        }
        await this.updateMutable(client, 'freight_lanes', laneColumns, id, patch, context.userId);
        return this.fetchById(client, 'freight_lanes', id, 'freight lane');
      }),
    );
  }

  private async listRequestChildren(
    requestId: string,
    query: string,
  ): Promise<readonly FreightNormalizedRecord[]> {
    const id = requireWave0019Uuid(requestId, 'requestId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireRequest(client, id);
      const result = await client.query<FreightNormalizedRecord>(query, [id]);
      return result.rows;
    });
  }

  private createRequestChild(
    requestId: string,
    table: string,
    columns: Readonly<Record<string, string>>,
    data: MutablePatch,
    label: string,
  ): Promise<FreightNormalizedRecord> {
    const id = requireWave0019Uuid(requestId, 'requestId');
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        await this.requireRequest(client, id);
        const row = await this.insertMutable(
          client,
          table,
          columns,
          data,
          context.tenantId,
          context.userId,
          id,
        );
        return this.fetchRequestChild(client, table, String(row.id), id, label);
      }),
    );
  }

  private updateRequestChild(
    requestId: string,
    childId: string,
    table: string,
    columns: Readonly<Record<string, string>>,
    patch: MutablePatch,
    label: string,
  ): Promise<FreightNormalizedRecord> {
    const requestUuid = requireWave0019Uuid(requestId, 'requestId');
    const id = requireWave0019Uuid(childId, `${label}Id`);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        await this.fetchRequestChild(client, table, id, requestUuid, label);
        await this.updateMutable(client, table, columns, id, patch, context.userId);
        return this.fetchRequestChild(client, table, id, requestUuid, label);
      }),
    );
  }

  private deleteRequestChild(
    requestId: string,
    childId: string,
    table: string,
    label: string,
  ): Promise<void> {
    const requestUuid = requireWave0019Uuid(requestId, 'requestId');
    const id = requireWave0019Uuid(childId, `${label}Id`);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        const result = await client.query(
          `DELETE FROM ${table} WHERE id=$1::uuid AND transport_request_id=$2::uuid`,
          [id, requestUuid],
        );
        if (result.rowCount !== 1)
          throw new NotFoundException(`${label} not found for transport request`);
      }),
    );
  }

  private async insertMutable(
    client: TenantQueryClient,
    table: string,
    columns: Readonly<Record<string, string>>,
    data: MutablePatch,
    tenantId: string,
    userId: string,
    requestId?: string,
  ): Promise<FreightNormalizedRecord> {
    const entries = Object.entries(data).map(([field, value]) => {
      const column = columns[field];
      if (!column) throw new BadRequestException(`Unsupported field ${field}`);
      return [column, value] as const;
    });
    const baseColumns = ['tenant_id'];
    const values: unknown[] = [tenantId];
    if (requestId) {
      baseColumns.push('transport_request_id');
      values.push(requestId);
    }
    for (const [, value] of entries) values.push(serialize(value));
    values.push(userId, userId);
    const allColumns = [
      ...baseColumns,
      ...entries.map(([column]) => column),
      'created_by_user_id',
      'updated_by_user_id',
    ];
    const placeholders = values.map((_, index) => `$${index + 1}`);
    const result = await client.query<FreightNormalizedRecord>(
      `INSERT INTO ${table} (${allColumns.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`,
      values,
    );
    return result.rows[0]!;
  }

  private async updateMutable(
    client: TenantQueryClient,
    table: string,
    columns: Readonly<Record<string, string>>,
    id: string,
    patch: MutablePatch,
    userId: string,
  ): Promise<void> {
    const values: unknown[] = [id];
    const sets = Object.entries(patch).map(([field, value]) => {
      const column = columns[field];
      if (!column) throw new BadRequestException(`Unsupported field ${field}`);
      values.push(serialize(value));
      return `${column}=$${values.length}`;
    });
    values.push(userId);
    sets.push(`updated_by_user_id=$${values.length}::uuid`, 'updated_at=now()');
    await client.query(`UPDATE ${table} SET ${sets.join(',')} WHERE id=$1::uuid`, values);
  }

  private async fetchRequestChild(
    client: TenantQueryClient,
    table: string,
    id: string,
    requestId: string,
    label: string,
  ): Promise<FreightNormalizedRecord> {
    const result = await client.query<FreightNormalizedRecord>(
      `SELECT * FROM ${table} WHERE id=$1::uuid AND transport_request_id=$2::uuid`,
      [id, requestId],
    );
    if (!result.rows[0]) throw new NotFoundException(`${label} not found for transport request`);
    return result.rows[0];
  }

  private async fetchById(
    client: TenantQueryClient,
    table: string,
    id: string,
    label: string,
  ): Promise<FreightNormalizedRecord> {
    const result = await client.query<FreightNormalizedRecord>(
      `SELECT * FROM ${table} WHERE id=$1::uuid`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException(`${label} not found`);
    return result.rows[0];
  }

  private async requireRequest(client: TenantQueryClient, requestId: string): Promise<void> {
    const result = await client.query(
      'SELECT 1 FROM transport_requests WHERE id=$1::uuid LIMIT 1',
      [requestId],
    );
    if (result.rowCount !== 1)
      throw new NotFoundException('Transport request not found in current tenant');
  }

  private async wrap<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === '23505')
        throw new ConflictException(
          'Freight normalization record conflicts with an existing record',
        );
      if (code === '23503')
        throw new BadRequestException('Referenced entity does not exist in the current tenant');
      if (code === '23514' || code === '22P02')
        throw new BadRequestException('Freight normalization data violates a database constraint');
      if (code === '42501')
        throw new ConflictException('Operation is not allowed by the Wave 0019 runtime policy');
      throw error;
    }
  }
}

function serialize(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) return JSON.stringify(value);
  return value;
}
