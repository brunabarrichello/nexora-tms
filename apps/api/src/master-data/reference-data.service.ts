import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import {
  isTenantCatalog,
  parseReferenceListQuery,
  parseTenantCatalogCreate,
  parseTenantCatalogUpdate,
  requireUuid,
  type ReferenceCatalogKind,
  type ReferenceListQuery,
} from './reference-data.validation.js';

export interface ReferenceDataItem {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly [key: string]: unknown;
}

export interface ReferenceDataPage {
  readonly items: readonly ReferenceDataItem[];
  readonly page: {
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
  };
}

interface CatalogDefinition {
  readonly table: string;
  readonly select: string;
  readonly tenantScoped: boolean;
  readonly searchableColumns: readonly string[];
  readonly orderBy: string;
  readonly fields?: Readonly<Record<string, string>>;
}

interface RawRow {
  readonly [key: string]: unknown;
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

const definitions: Readonly<Record<ReferenceCatalogKind, CatalogDefinition>> = {
  countries: {
    table: 'countries',
    select:
      'id::text AS id, code, iso3, numeric_code AS "numericCode", name, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"',
    tenantScoped: false,
    searchableColumns: ['code', 'iso3', 'name'],
    orderBy: 'name, id',
  },
  states: {
    table: 'states',
    select:
      'id::text AS id, country_id::text AS "countryId", code, name, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"',
    tenantScoped: false,
    searchableColumns: ['code', 'name'],
    orderBy: 'name, id',
  },
  cities: {
    table: 'cities',
    select:
      'id::text AS id, state_id::text AS "stateId", ibge_code AS "ibgeCode", name, latitude, longitude, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"',
    tenantScoped: false,
    searchableColumns: ['ibge_code', 'name'],
    orderBy: 'name, id',
  },
  unitsOfMeasure: {
    table: 'units_of_measure',
    select:
      'id::text AS id, code, name, dimension, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"',
    tenantScoped: false,
    searchableColumns: ['code', 'name', 'dimension'],
    orderBy: 'dimension, name, id',
  },
  vehicleTypes: {
    table: 'vehicle_types',
    select:
      'id::text AS id, code, name, description, default_max_weight_kg AS "defaultMaxWeightKg", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"',
    tenantScoped: true,
    searchableColumns: ['code', 'name', 'description'],
    orderBy: 'name, id',
    fields: {
      code: 'code',
      name: 'name',
      description: 'description',
      defaultMaxWeightKg: 'default_max_weight_kg',
      isActive: 'is_active',
    },
  },
  bodyTypes: {
    table: 'body_types',
    select:
      'id::text AS id, code, name, description, is_closed AS "isClosed", supports_side_loading AS "supportsSideLoading", supports_rear_loading AS "supportsRearLoading", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"',
    tenantScoped: true,
    searchableColumns: ['code', 'name', 'description'],
    orderBy: 'name, id',
    fields: {
      code: 'code',
      name: 'name',
      description: 'description',
      isClosed: 'is_closed',
      supportsSideLoading: 'supports_side_loading',
      supportsRearLoading: 'supports_rear_loading',
      isActive: 'is_active',
    },
  },
  cargoTypes: {
    table: 'cargo_types',
    select:
      'id::text AS id, code, name, description, requires_special_handling AS "requiresSpecialHandling", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"',
    tenantScoped: true,
    searchableColumns: ['code', 'name', 'description'],
    orderBy: 'name, id',
    fields: {
      code: 'code',
      name: 'name',
      description: 'description',
      requiresSpecialHandling: 'requires_special_handling',
      isActive: 'is_active',
    },
  },
  packageTypes: {
    table: 'package_types',
    select:
      'id::text AS id, code, name, description, stackable_default AS "stackableDefault", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"',
    tenantScoped: true,
    searchableColumns: ['code', 'name', 'description'],
    orderBy: 'name, id',
    fields: {
      code: 'code',
      name: 'name',
      description: 'description',
      stackableDefault: 'stackable_default',
      isActive: 'is_active',
    },
  },
  documentTypes: {
    table: 'document_types',
    select:
      'id::text AS id, code, name, subject_scope AS "subjectScope", has_expiry AS "hasExpiry", requires_validation AS "requiresValidation", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"',
    tenantScoped: true,
    searchableColumns: ['code', 'name', 'subject_scope'],
    orderBy: 'subject_scope, name, id',
    fields: {
      code: 'code',
      name: 'name',
      subjectScope: 'subject_scope',
      hasExpiry: 'has_expiry',
      requiresValidation: 'requires_validation',
      isActive: 'is_active',
    },
  },
  tags: {
    table: 'tags',
    select:
      'id::text AS id, code, name, description, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"',
    tenantScoped: true,
    searchableColumns: ['code', 'name', 'description'],
    orderBy: 'name, id',
    fields: {
      code: 'code',
      name: 'name',
      description: 'description',
      isActive: 'is_active',
    },
  },
};

@Injectable()
export class ReferenceDataService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async list(
    kind: ReferenceCatalogKind,
    rawQuery: Record<string, unknown>,
  ): Promise<ReferenceDataPage> {
    const query = parseReferenceListQuery(rawQuery);
    const context = this.tenantContext.require();
    const definition = definitions[kind];

    return this.database.withTenantContext(context, async (client) => {
      const params: unknown[] = [];
      const where: string[] = [];

      if (definition.tenantScoped) {
        params.push(context.tenantId);
        where.push(`tenant_id = $${params.length}::uuid`);
      }

      if (query.q) {
        params.push(`%${query.q}%`);
        const placeholder = `$${params.length}`;
        where.push(
          `(${definition.searchableColumns.map((column) => `${column} ILIKE ${placeholder}`).join(' OR ')})`,
        );
      }

      if (query.active !== null) {
        params.push(query.active);
        where.push(`is_active = $${params.length}`);
      }

      this.addScopedFilters(kind, query, params, where);
      const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
      const countResult = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${definition.table} ${whereSql}`,
        params,
      );

      const listParams = [...params, query.limit, query.offset];
      const result = await client.query<RawRow>(
        `SELECT ${definition.select}
           FROM ${definition.table}
           ${whereSql}
          ORDER BY ${definition.orderBy}
          LIMIT $${listParams.length - 1}
         OFFSET $${listParams.length}`,
        listParams,
      );

      return {
        items: result.rows.map(normalizeRow),
        page: {
          total: Number(countResult.rows[0]?.count ?? 0),
          limit: query.limit,
          offset: query.offset,
        },
      };
    });
  }

  async getById(kind: ReferenceCatalogKind, id: string): Promise<ReferenceDataItem> {
    const resourceId = requireUuid(id);
    const context = this.tenantContext.require();
    const definition = definitions[kind];

    return this.database.withTenantContext(context, async (client) => {
      const params: unknown[] = [resourceId];
      const where = ['id = $1::uuid'];
      if (definition.tenantScoped) {
        params.push(context.tenantId);
        where.push(`tenant_id = $${params.length}::uuid`);
      }
      const result = await client.query<RawRow>(
        `SELECT ${definition.select}
           FROM ${definition.table}
          WHERE ${where.join(' AND ')}`,
        params,
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException('Reference data item was not found');
      return normalizeRow(row);
    });
  }

  async create(kind: ReferenceCatalogKind, input: unknown): Promise<ReferenceDataItem> {
    if (!isTenantCatalog(kind)) throw new BadRequestException('Reference catalog is read-only');
    const data = parseTenantCatalogCreate(kind, input);
    const context = this.tenantContext.require();
    const definition = definitions[kind];

    try {
      return await this.database.withTenantContext(context, async (client) => {
        const entries = this.writeEntries(definition, data);
        const columns = ['tenant_id', ...entries.map((entry) => entry.column)];
        const values: unknown[] = [context.tenantId, ...entries.map((entry) => entry.value)];
        const placeholders = values.map((_, index) => `$${index + 1}`);
        const result = await client.query<RawRow>(
          `INSERT INTO ${definition.table} (${columns.join(', ')})
           VALUES (${placeholders.join(', ')})
           RETURNING ${definition.select}`,
          values,
        );
        return normalizeRow(result.rows[0]!);
      });
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async update(kind: ReferenceCatalogKind, id: string, input: unknown): Promise<ReferenceDataItem> {
    if (!isTenantCatalog(kind)) throw new BadRequestException('Reference catalog is read-only');
    const resourceId = requireUuid(id);
    const patch = parseTenantCatalogUpdate(kind, input);
    const context = this.tenantContext.require();
    const definition = definitions[kind];

    try {
      return await this.database.withTenantContext(context, async (client) => {
        const entries = this.writeEntries(definition, patch);
        const values: unknown[] = [
          resourceId,
          context.tenantId,
          ...entries.map((entry) => entry.value),
        ];
        const assignments = entries.map((entry, index) => `${entry.column} = $${index + 3}`);
        assignments.push('updated_at = now()');
        const result = await client.query<RawRow>(
          `UPDATE ${definition.table}
              SET ${assignments.join(', ')}
            WHERE id = $1::uuid
              AND tenant_id = $2::uuid
          RETURNING ${definition.select}`,
          values,
        );
        const row = result.rows[0];
        if (!row) throw new NotFoundException('Reference data item was not found');
        return normalizeRow(row);
      });
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  private addScopedFilters(
    kind: ReferenceCatalogKind,
    query: ReferenceListQuery,
    params: unknown[],
    where: string[],
  ): void {
    if (kind === 'states' && query.countryId) {
      params.push(query.countryId);
      where.push(`country_id = $${params.length}::uuid`);
    }
    if (kind === 'cities' && query.stateId) {
      params.push(query.stateId);
      where.push(`state_id = $${params.length}::uuid`);
    }
    if (kind === 'unitsOfMeasure' && query.dimension) {
      params.push(query.dimension);
      where.push(`dimension = $${params.length}`);
    }
    if (kind === 'documentTypes' && query.subjectScope) {
      params.push(query.subjectScope);
      where.push(`subject_scope = $${params.length}`);
    }
  }

  private writeEntries(
    definition: CatalogDefinition,
    data: Record<string, unknown>,
  ): Array<{ column: string; value: unknown }> {
    if (!definition.fields) throw new BadRequestException('Reference catalog is read-only');
    return Object.entries(data).map(([field, value]) => {
      const column = definition.fields?.[field];
      if (!column) throw new BadRequestException(`${field} is not writable for this catalog`);
      return { column, value };
    });
  }

  private rethrowConstraint(error: unknown): never {
    if (isPgError(error, '23505')) {
      throw new ConflictException('A reference item with this code already exists in this scope');
    }
    if (isPgError(error, '23514') || isPgError(error, '22P02')) {
      throw new BadRequestException('Reference data violates a catalog constraint');
    }
    throw error;
  }
}

function normalizeRow(row: RawRow): ReferenceDataItem {
  const normalized: Record<string, unknown> = { ...row };
  for (const key of ['createdAt', 'updatedAt']) {
    if (normalized[key] instanceof Date) normalized[key] = normalized[key].toISOString();
  }
  return normalized as ReferenceDataItem;
}

function isPgError(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code);
}
