import { Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import { requireUuid } from './business-party.validation.js';
import {
  parseCommodity,
  parseCustomFieldDefinition,
  parseDimension,
  parseLocation,
  parsePartyGroup,
  parsePartyRequirement,
  requireCustomFieldEntityType,
  requireTaggedEntityType,
  validateCustomFieldValue,
  type CustomFieldDataType,
  type CustomFieldEntityType,
  type TaggedEntityType,
} from './master-data-enrichment.validation.js';

export interface MasterDataRecord {
  readonly id: string;
  readonly [key: string]: unknown;
}

interface SequenceRow {
  readonly prefix: string | null;
  readonly allocated_value: string;
  readonly padding: number;
}

interface CustomFieldDefinitionRow {
  readonly id: string;
  readonly entity_type: CustomFieldEntityType;
  readonly data_type: CustomFieldDataType;
  readonly is_required: boolean;
  readonly is_active: boolean;
}

const dimensionTables = {
  departments: 'departments',
  'cost-centers': 'cost_centers',
} as const;

type DimensionKind = keyof typeof dimensionTables;

const customFieldSubjectTables: Record<CustomFieldEntityType, string> = {
  business_party: 'business_parties',
  driver: 'drivers',
  capacity_asset: 'capacity_assets',
  transport_request: 'transport_requests',
  location: 'locations',
};

const tagTargets: Record<
  TaggedEntityType,
  { readonly sourceTable: string; readonly linkTable: string; readonly subjectColumn: string }
> = {
  business_party: {
    sourceTable: 'business_parties',
    linkTable: 'business_party_tags',
    subjectColumn: 'party_id',
  },
  driver: { sourceTable: 'drivers', linkTable: 'driver_tags', subjectColumn: 'driver_id' },
  capacity_asset: {
    sourceTable: 'capacity_assets',
    linkTable: 'capacity_asset_tags',
    subjectColumn: 'asset_id',
  },
  transport_request: {
    sourceTable: 'transport_requests',
    linkTable: 'transport_request_tags',
    subjectColumn: 'transport_request_id',
  },
};

function requireDimensionKind(value: string): DimensionKind {
  if (!(value in dimensionTables)) {
    throw new NotFoundException('Unsupported master-data dimension');
  }
  return value as DimensionKind;
}

@Injectable()
export class MasterDataEnrichmentService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  listLocations(): Promise<readonly MasterDataRecord[]> {
    return this.withTenant(async (client) => {
      const result = await client.query<MasterDataRecord>(
        `SELECT id::text AS id, code, name, type, party_id::text AS "partyId",
                address_id::text AS "addressId", city_id::text AS "cityId", postal_code AS "postalCode",
                street, number, complement, district, latitude::text AS latitude,
                longitude::text AS longitude, operational_reference AS "operationalReference",
                is_active AS "isActive", deleted_at AS "deletedAt", created_at AS "createdAt", updated_at AS "updatedAt"
           FROM locations
          WHERE deleted_at IS NULL
          ORDER BY name, code`,
      );
      return result.rows;
    });
  }

  createLocation(input: unknown): Promise<MasterDataRecord> {
    const data = parseLocation(input);
    return this.withTenant(async (client, tenantId, userId) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO locations (
           tenant_id, created_by_user_id, updated_by_user_id, party_id, address_id, code, name, type,
           city_id, postal_code, street, number, complement, district, latitude, longitude,
           operational_reference, is_active
         ) VALUES (
           $1::uuid, $2::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7,
           $8::uuid, $9, $10, $11, $12, $13, $14, $15, $16, $17
         ) RETURNING id::text AS id`,
        [
          tenantId,
          userId,
          data.partyId,
          data.addressId,
          data.code,
          data.name,
          data.type,
          data.cityId,
          data.postalCode,
          data.street,
          data.number,
          data.complement,
          data.district,
          data.latitude,
          data.longitude,
          data.operationalReference,
          data.isActive,
        ],
      );
      return this.requireSimple(client, 'locations', inserted.rows[0]!.id);
    });
  }

  setLocationLifecycle(idInput: string, isActive: boolean): Promise<MasterDataRecord> {
    const id = requireUuid(idInput, 'locationId');
    return this.withTenant(async (client, _tenantId, userId) => {
      const result = await client.query<{ id: string }>(
        `UPDATE locations
            SET is_active=$2,
                deleted_at=CASE WHEN $2 THEN NULL ELSE now() END,
                deleted_by_user_id=CASE WHEN $2 THEN NULL ELSE $3::uuid END,
                updated_by_user_id=$3::uuid,
                updated_at=now()
          WHERE id=$1::uuid
          RETURNING id::text AS id`,
        [id, isActive, userId],
      );
      if (!result.rowCount) throw new NotFoundException('Location not found');
      return this.requireSimple(client, 'locations', id);
    });
  }

  listDimensions(kindInput: string): Promise<readonly MasterDataRecord[]> {
    const kind = requireDimensionKind(kindInput);
    const table = dimensionTables[kind];
    return this.withTenant(async (client) => {
      const result = await client.query<MasterDataRecord>(
        `SELECT id::text AS id, organization_id::text AS "organizationId",
                business_unit_id::text AS "businessUnitId", code, name,
                is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
           FROM ${table}
          ORDER BY name, code`,
      );
      return result.rows;
    });
  }

  createDimension(kindInput: string, input: unknown): Promise<MasterDataRecord> {
    const kind = requireDimensionKind(kindInput);
    const table = dimensionTables[kind];
    const data = parseDimension(input);
    return this.withTenant(async (client, tenantId, userId) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO ${table} (
           tenant_id, created_by_user_id, updated_by_user_id, organization_id, business_unit_id,
           code, name, is_active
         ) VALUES ($1::uuid, $2::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7)
         RETURNING id::text AS id`,
        [
          tenantId,
          userId,
          data.organizationId,
          data.businessUnitId,
          data.code,
          data.name,
          data.isActive,
        ],
      );
      return this.requireSimple(client, table, inserted.rows[0]!.id);
    });
  }

  listCommodities(): Promise<readonly MasterDataRecord[]> {
    return this.withTenant(async (client) => {
      const result = await client.query<MasterDataRecord>(
        `SELECT id::text AS id, code, name, description,
                default_cargo_type_id::text AS "defaultCargoTypeId",
                is_hazardous AS "isHazardous",
                requires_temperature_control AS "requiresTemperatureControl",
                is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
           FROM commodities
          ORDER BY name, code`,
      );
      return result.rows;
    });
  }

  createCommodity(input: unknown): Promise<MasterDataRecord> {
    const data = parseCommodity(input);
    return this.withTenant(async (client, tenantId, userId) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO commodities (
           tenant_id, created_by_user_id, updated_by_user_id, code, name, description,
           default_cargo_type_id, is_hazardous, requires_temperature_control, is_active
         ) VALUES ($1::uuid,$2::uuid,$2::uuid,$3,$4,$5,$6::uuid,$7,$8,$9)
         RETURNING id::text AS id`,
        [
          tenantId,
          userId,
          data.code,
          data.name,
          data.description,
          data.defaultCargoTypeId,
          data.isHazardous,
          data.requiresTemperatureControl,
          data.isActive,
        ],
      );
      return this.requireSimple(client, 'commodities', inserted.rows[0]!.id);
    });
  }

  listPartyGroups(): Promise<readonly MasterDataRecord[]> {
    return this.withTenant(async (client) => {
      const result = await client.query<MasterDataRecord>(
        `SELECT id::text AS id, code, name, group_type AS "groupType", is_active AS "isActive",
                created_at AS "createdAt", updated_at AS "updatedAt"
           FROM business_party_groups
          ORDER BY name, code`,
      );
      return result.rows;
    });
  }

  createPartyGroup(input: unknown): Promise<MasterDataRecord> {
    const data = parsePartyGroup(input);
    return this.withTenant(async (client, tenantId, userId) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO business_party_groups (
           tenant_id, created_by_user_id, updated_by_user_id, code, name, group_type, is_active
         ) VALUES ($1::uuid,$2::uuid,$2::uuid,$3,$4,$5,$6)
         RETURNING id::text AS id`,
        [tenantId, userId, data.code, data.name, data.groupType, data.isActive],
      );
      return this.requireSimple(client, 'business_party_groups', inserted.rows[0]!.id);
    });
  }

  setPartyGroupMembership(
    groupIdInput: string,
    partyIdInput: string,
    active: boolean,
  ): Promise<void> {
    const groupId = requireUuid(groupIdInput, 'groupId');
    const partyId = requireUuid(partyIdInput, 'partyId');
    return this.withTenant(async (client, tenantId, userId) => {
      await this.requireEntity(client, 'business_party_groups', groupId);
      await this.requireEntity(client, 'business_parties', partyId);
      if (active) {
        await client.query(
          `INSERT INTO business_party_group_members (tenant_id, group_id, party_id, starts_on, created_by_user_id)
           VALUES ($1::uuid,$2::uuid,$3::uuid,current_date,$4::uuid)
           ON CONFLICT (tenant_id, group_id, party_id)
           DO UPDATE SET ends_on=NULL`,
          [tenantId, groupId, partyId, userId],
        );
      } else {
        await client.query(
          `UPDATE business_party_group_members SET ends_on=current_date
            WHERE group_id=$1::uuid AND party_id=$2::uuid`,
          [groupId, partyId],
        );
      }
    });
  }

  listPartyRequirements(partyIdInput: string): Promise<readonly MasterDataRecord[]> {
    const partyId = requireUuid(partyIdInput, 'partyId');
    return this.withTenant(async (client) => {
      await this.requireEntity(client, 'business_parties', partyId);
      const result = await client.query<MasterDataRecord>(
        `SELECT id::text AS id, requirement_type AS "requirementType", value_text AS "valueText",
                value_json AS "valueJson", is_mandatory AS "isMandatory", valid_from AS "validFrom",
                valid_until AS "validUntil", is_active AS "isActive", created_at AS "createdAt",
                updated_at AS "updatedAt"
           FROM business_party_requirements
          WHERE party_id=$1::uuid
          ORDER BY requirement_type, created_at`,
        [partyId],
      );
      return result.rows;
    });
  }

  createPartyRequirement(partyIdInput: string, input: unknown): Promise<MasterDataRecord> {
    const partyId = requireUuid(partyIdInput, 'partyId');
    const data = parsePartyRequirement(input);
    const valueText = typeof data.value === 'string' ? data.value : null;
    const valueJson = typeof data.value === 'string' || data.value === null ? null : data.value;
    return this.withTenant(async (client, tenantId, userId) => {
      await this.requireEntity(client, 'business_parties', partyId);
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO business_party_requirements (
           tenant_id, created_by_user_id, updated_by_user_id, party_id, requirement_type,
           value_text, value_json, is_mandatory, valid_from, valid_until, is_active
         ) VALUES ($1::uuid,$2::uuid,$2::uuid,$3::uuid,$4,$5,$6::jsonb,$7,$8::date,$9::date,$10)
         RETURNING id::text AS id`,
        [
          tenantId,
          userId,
          partyId,
          data.requirementType,
          valueText,
          valueJson === null ? null : JSON.stringify(valueJson),
          data.isMandatory,
          data.validFrom,
          data.validUntil,
          data.isActive,
        ],
      );
      return this.requireSimple(client, 'business_party_requirements', inserted.rows[0]!.id);
    });
  }

  listCustomFieldDefinitions(): Promise<readonly MasterDataRecord[]> {
    return this.withTenant(async (client) => {
      const result = await client.query<MasterDataRecord>(
        `SELECT id::text AS id, entity_type AS "entityType", key, label, data_type AS "dataType",
                is_required AS "isRequired", validation, is_active AS "isActive",
                created_at AS "createdAt", updated_at AS "updatedAt"
           FROM custom_field_definitions
          ORDER BY entity_type, key`,
      );
      return result.rows;
    });
  }

  createCustomFieldDefinition(input: unknown): Promise<MasterDataRecord> {
    const data = parseCustomFieldDefinition(input);
    return this.withTenant(async (client, tenantId, userId) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO custom_field_definitions (
           tenant_id, created_by_user_id, updated_by_user_id, entity_type, key, label, data_type,
           is_required, validation, is_active
         ) VALUES ($1::uuid,$2::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,$9)
         RETURNING id::text AS id`,
        [
          tenantId,
          userId,
          data.entityType,
          data.key,
          data.label,
          data.dataType,
          data.isRequired,
          data.validation === null ? null : JSON.stringify(data.validation),
          data.isActive,
        ],
      );
      return this.requireSimple(client, 'custom_field_definitions', inserted.rows[0]!.id);
    });
  }

  setCustomFieldValue(
    definitionIdInput: string,
    entityTypeInput: string,
    subjectIdInput: string,
    value: unknown,
  ): Promise<MasterDataRecord> {
    const definitionId = requireUuid(definitionIdInput, 'definitionId');
    const subjectId = requireUuid(subjectIdInput, 'subjectId');
    const entityType = requireCustomFieldEntityType(entityTypeInput);
    return this.withTenant(async (client, tenantId, userId) => {
      const definitionResult = await client.query<CustomFieldDefinitionRow>(
        `SELECT id::text AS id, entity_type, data_type, is_required, is_active
           FROM custom_field_definitions
          WHERE id=$1::uuid`,
        [definitionId],
      );
      const definition = definitionResult.rows[0];
      if (!definition || !definition.is_active) {
        throw new NotFoundException('Custom field definition not found or inactive');
      }
      if (definition.entity_type !== entityType) {
        throw new NotFoundException('Custom field definition does not belong to this entity type');
      }
      await this.requireEntity(client, customFieldSubjectTables[entityType], subjectId);
      const normalizedValue = validateCustomFieldValue(definition.data_type, value);
      const result = await client.query<{ id: string }>(
        `INSERT INTO custom_field_values (
           tenant_id, created_by_user_id, updated_by_user_id, definition_id, subject_id, value_json
         ) VALUES ($1::uuid,$2::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb)
         ON CONFLICT (tenant_id, definition_id, subject_id)
         DO UPDATE SET value_json=EXCLUDED.value_json,
                       updated_by_user_id=EXCLUDED.updated_by_user_id,
                       updated_at=now()
         RETURNING id::text AS id`,
        [tenantId, userId, definitionId, subjectId, JSON.stringify(normalizedValue)],
      );
      return this.requireSimple(client, 'custom_field_values', result.rows[0]!.id);
    });
  }

  setTag(
    entityTypeInput: string,
    subjectIdInput: string,
    tagIdInput: string,
    active: boolean,
  ): Promise<void> {
    const entityType = requireTaggedEntityType(entityTypeInput);
    const subjectId = requireUuid(subjectIdInput, 'subjectId');
    const tagId = requireUuid(tagIdInput, 'tagId');
    const target = tagTargets[entityType];
    return this.withTenant(async (client, tenantId, userId) => {
      await this.requireEntity(client, target.sourceTable, subjectId);
      await this.requireEntity(client, 'tags', tagId);
      await client.query(
        `INSERT INTO ${target.linkTable} (tenant_id, ${target.subjectColumn}, tag_id, created_by_user_id, is_active)
         VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)
         ON CONFLICT (tenant_id, ${target.subjectColumn}, tag_id)
         DO UPDATE SET is_active=EXCLUDED.is_active`,
        [tenantId, subjectId, tagId, userId, active],
      );
    });
  }

  allocateSequence(scopeInput: string): Promise<{ readonly value: string }> {
    const scope = scopeInput.trim();
    if (!scope || scope.length > 64) throw new NotFoundException('Invalid sequence scope');
    return this.withTenant(async (client, tenantId, userId) => {
      await client.query(
        `INSERT INTO number_sequences (
           tenant_id, created_by_user_id, updated_by_user_id, scope, next_value, padding
         ) VALUES ($1::uuid,$2::uuid,$2::uuid,$3,1,0)
         ON CONFLICT (tenant_id, scope) DO NOTHING`,
        [tenantId, userId, scope],
      );
      const result = await client.query<SequenceRow>(
        `UPDATE number_sequences
            SET next_value=next_value+1, updated_by_user_id=$2::uuid, updated_at=now()
          WHERE scope=$1
          RETURNING prefix, (next_value-1)::text AS allocated_value, padding`,
        [scope, userId],
      );
      const row = result.rows[0]!;
      const number = row.allocated_value.padStart(row.padding, '0');
      return { value: `${row.prefix ?? ''}${number}` };
    });
  }

  upsertTenantConfiguration(
    kind: 'module' | 'feature',
    keyInput: string,
    payload: unknown,
  ): Promise<MasterDataRecord> {
    const key = keyInput.trim();
    if (!key || key.length > 120) throw new NotFoundException('Invalid configuration key');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new NotFoundException('Configuration payload must be an object');
    }
    return this.withTenant(async (client, tenantId, userId) => {
      if (kind === 'module') {
        const result = await client.query<{ id: string }>(
          `INSERT INTO module_settings (tenant_id, created_by_user_id, updated_by_user_id, module, settings)
           VALUES ($1::uuid,$2::uuid,$2::uuid,$3,$4::jsonb)
           ON CONFLICT (tenant_id, module)
           DO UPDATE SET settings=EXCLUDED.settings, updated_by_user_id=EXCLUDED.updated_by_user_id, updated_at=now()
           RETURNING id::text AS id`,
          [tenantId, userId, key, JSON.stringify(payload)],
        );
        return this.requireSimple(client, 'module_settings', result.rows[0]!.id);
      }
      const configuration = payload as Record<string, unknown>;
      const enabled = typeof configuration.enabled === 'boolean' ? configuration.enabled : false;
      const result = await client.query<{ id: string }>(
        `INSERT INTO feature_flags (tenant_id, created_by_user_id, updated_by_user_id, key, enabled, configuration)
         VALUES ($1::uuid,$2::uuid,$2::uuid,$3,$4,$5::jsonb)
         ON CONFLICT (tenant_id, key)
         DO UPDATE SET enabled=EXCLUDED.enabled, configuration=EXCLUDED.configuration,
                       updated_by_user_id=EXCLUDED.updated_by_user_id, updated_at=now()
         RETURNING id::text AS id`,
        [tenantId, userId, key, enabled, JSON.stringify(configuration)],
      );
      return this.requireSimple(client, 'feature_flags', result.rows[0]!.id);
    });
  }

  private withTenant<T>(
    work: (client: TenantQueryClient, tenantId: string, userId: string) => Promise<T>,
  ): Promise<T> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, (client) =>
      work(client, context.tenantId, context.userId),
    );
  }

  private async requireEntity(client: TenantQueryClient, table: string, id: string): Promise<void> {
    const result = await client.query(`SELECT 1 FROM ${table} WHERE id=$1::uuid`, [id]);
    if (!result.rowCount) throw new NotFoundException('Referenced master-data entity not found');
  }

  private async requireSimple(
    client: TenantQueryClient,
    table: string,
    id: string,
  ): Promise<MasterDataRecord> {
    const result = await client.query<MasterDataRecord>(
      `SELECT *, id::text AS id FROM ${table} WHERE id=$1::uuid`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Master-data record not found');
    return row;
  }
}
