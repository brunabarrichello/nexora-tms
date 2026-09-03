import { BadRequestException, Injectable } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';

export interface OperationalReportQuery {
  readonly from?: string;
  readonly to?: string;
  readonly customerPartyId?: string;
  readonly origin?: string;
  readonly destination?: string;
  readonly status?: string;
  readonly page?: string;
  readonly pageSize?: string;
}

export interface ParsedOperationalReportQuery {
  readonly from: Date;
  readonly to: Date;
  readonly customerPartyId?: string;
  readonly origin?: string;
  readonly destination?: string;
  readonly status?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface OperationalReportRow {
  readonly transportRequestId: string;
  readonly cargoDescription: string;
  readonly requestStatus: string;
  readonly customer: string;
  readonly origin: string;
  readonly destination: string;
  readonly plannedPickupAt: string;
  readonly plannedDeliveryAt: string;
  readonly contractStatus: string | null;
  readonly contractId: string | null;
  readonly tripCode: string | null;
  readonly tripStatus: string | null;
  readonly tripId: string | null;
}

export interface OperationalReportResult {
  readonly period: { from: string; to: string };
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly rows: readonly OperationalReportRow[];
  readonly generatedAt: string;
}

interface ReportDbRow {
  readonly transport_request_id: string;
  readonly cargo_description: string;
  readonly request_status: string;
  readonly customer_name: string;
  readonly origin_city: string;
  readonly origin_state: string;
  readonly destination_city: string;
  readonly destination_state: string;
  readonly planned_pickup_at: Date;
  readonly planned_delivery_at: Date;
  readonly contract_status: string | null;
  readonly contract_id: string | null;
  readonly trip_code: string | null;
  readonly trip_status: string | null;
  readonly trip_id: string | null;
}

interface CountRow {
  readonly total: string;
}

const REQUEST_STATUSES = new Set([
  'draft',
  'ready_for_quote',
  'in_negotiation',
  'contracted',
  'cancelled',
]);

@Injectable()
export class OperationalReportService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async getReport(query: OperationalReportQuery): Promise<OperationalReportResult> {
    const parsed = parseOperationalReportQuery(query);
    const filters: string[] = [
      'r.created_at >= $1::timestamptz',
      'r.created_at < $2::timestamptz',
    ];
    const params: unknown[] = [parsed.from.toISOString(), parsed.to.toISOString()];

    const addSingle = (sql: string, value: unknown) => {
      params.push(value);
      filters.push(sql.replace('$N', `$${params.length}`));
    };

    const addLocationFilter = (alias: 'oa' | 'da', value: string) => {
      params.push(`%${value}%`);
      const cityParam = params.length;
      params.push(`%${value}%`);
      const stateParam = params.length;
      filters.push(`(${alias}.city ILIKE $${cityParam} OR ${alias}.state ILIKE $${stateParam})`);
    };

    if (parsed.customerPartyId) addSingle('r.customer_party_id = $N::uuid', parsed.customerPartyId);
    if (parsed.status) addSingle('r.status::text = $N', parsed.status);
    if (parsed.origin) addLocationFilter('oa', parsed.origin);
    if (parsed.destination) addLocationFilter('da', parsed.destination);

    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const fromWhere = filters.join(' AND ');
      const count = await client.query<CountRow>(
        `SELECT count(*)::text AS total
           FROM transport_requests r
           JOIN business_parties customer ON customer.id = r.customer_party_id
           JOIN business_party_addresses oa ON oa.id = r.origin_address_id
           JOIN business_party_addresses da ON da.id = r.destination_address_id
          WHERE ${fromWhere}`,
        params,
      );

      const dataParams = [...params, parsed.pageSize, (parsed.page - 1) * parsed.pageSize];
      const result = await client.query<ReportDbRow>(
        `SELECT
           r.id::text AS transport_request_id,
           r.cargo_description,
           r.status::text AS request_status,
           coalesce(customer.trade_name, customer.legal_name) AS customer_name,
           oa.city AS origin_city,
           oa.state AS origin_state,
           da.city AS destination_city,
           da.state AS destination_state,
           r.planned_pickup_at,
           r.planned_delivery_at,
           contract.status::text AS contract_status,
           contract.id::text AS contract_id,
           trip.code AS trip_code,
           trip.status::text AS trip_status,
           trip.id::text AS trip_id
         FROM transport_requests r
         JOIN business_parties customer ON customer.id = r.customer_party_id
         JOIN business_party_addresses oa ON oa.id = r.origin_address_id
         JOIN business_party_addresses da ON da.id = r.destination_address_id
         LEFT JOIN LATERAL (
           SELECT c.id, c.status
             FROM transport_contracts c
            WHERE c.transport_request_id = r.id
              AND c.status IN ('confirmed','fulfilled')
            ORDER BY c.created_at DESC, c.id DESC
            LIMIT 1
         ) contract ON true
         LEFT JOIN LATERAL (
           SELECT t.id, t.code, t.status
             FROM trip_transport_requests ttr
             JOIN trips t ON t.id = ttr.trip_id
            WHERE ttr.transport_request_id = r.id
              AND ttr.removed_at IS NULL
            ORDER BY ttr.created_at DESC, t.id DESC
            LIMIT 1
         ) trip ON true
        WHERE ${fromWhere}
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams,
      );

      return {
        period: { from: parsed.from.toISOString(), to: parsed.to.toISOString() },
        page: parsed.page,
        pageSize: parsed.pageSize,
        total: Number(count.rows[0]?.total ?? '0'),
        rows: result.rows.map(mapRow),
        generatedAt: new Date().toISOString(),
      };
    });
  }
}

export function parseOperationalReportQuery(query: OperationalReportQuery): ParsedOperationalReportQuery {
  const to = parseDate(query.to, 'to') ?? new Date();
  const from = parseDate(query.from, 'from') ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (from >= to) throw new BadRequestException('from must be earlier than to');
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new BadRequestException('report period cannot exceed 366 days');
  }

  const customerPartyId = query.customerPartyId?.trim() || undefined;
  if (
    customerPartyId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      customerPartyId,
    )
  ) {
    throw new BadRequestException('customerPartyId must be a valid UUID');
  }

  const status = query.status?.trim() || undefined;
  if (status && !REQUEST_STATUSES.has(status)) {
    throw new BadRequestException(`status must be one of: ${[...REQUEST_STATUSES].join(', ')}`);
  }

  return {
    from,
    to,
    customerPartyId,
    origin: normalizeTextFilter(query.origin),
    destination: normalizeTextFilter(query.destination),
    status,
    page: parsePositiveInt(query.page, 'page', 1, 1000000),
    pageSize: parsePositiveInt(query.pageSize, 'pageSize', 25, 100),
  };
}

function parseDate(value: string | undefined, field: string): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid ISO date or timestamp`);
  }
  return date;
}

function normalizeTextFilter(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > 120) {
    throw new BadRequestException('text filters cannot exceed 120 characters');
  }
  return normalized;
}

function parsePositiveInt(value: string | undefined, field: string, fallback: number, max: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new BadRequestException(`${field} must be an integer between 1 and ${max}`);
  }
  return parsed;
}

function mapRow(row: ReportDbRow): OperationalReportRow {
  return {
    transportRequestId: row.transport_request_id,
    cargoDescription: row.cargo_description,
    requestStatus: row.request_status,
    customer: row.customer_name,
    origin: `${row.origin_city}/${row.origin_state}`,
    destination: `${row.destination_city}/${row.destination_state}`,
    plannedPickupAt: row.planned_pickup_at.toISOString(),
    plannedDeliveryAt: row.planned_delivery_at.toISOString(),
    contractStatus: row.contract_status,
    contractId: row.contract_id,
    tripCode: row.trip_code,
    tripStatus: row.trip_status,
    tripId: row.trip_id,
  };
}
