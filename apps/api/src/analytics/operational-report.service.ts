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

interface CountRow { readonly total: string; }

@Injectable()
export class OperationalReportService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async getReport(query: OperationalReportQuery): Promise<OperationalReportResult> {
    const period = parsePeriod(query);
    const page = parsePositiveInt(query.page, 'page', 1, 1000000);
    const pageSize = parsePositiveInt(query.pageSize, 'pageSize', 25, 100);
    const offset = (page - 1) * pageSize;
    const filters: string[] = [
      'r.created_at >= $1::timestamptz',
      'r.created_at < $2::timestamptz',
    ];
    const params: unknown[] = [period.from.toISOString(), period.to.toISOString()];

    const add = (sql: string, value: unknown) => {
      params.push(value);
      filters.push(sql.replace('$N', `$${params.length}`));
    };

    if (query.customerPartyId?.trim()) add('r.customer_party_id = $N::uuid', query.customerPartyId.trim());
    if (query.status?.trim()) add('r.status::text = $N', query.status.trim());
    if (query.origin?.trim()) {
      add('(oa.city ILIKE $N OR oa.state ILIKE $N)', `%${query.origin.trim()}%`);
      params.push(`%${query.origin.trim()}%`);
      filters[filters.length - 1] = `(oa.city ILIKE $${params.length - 1} OR oa.state ILIKE $${params.length})`;
    }
    if (query.destination?.trim()) {
      add('(da.city ILIKE $N OR da.state ILIKE $N)', `%${query.destination.trim()}%`);
      params.push(`%${query.destination.trim()}%`);
      filters[filters.length - 1] = `(da.city ILIKE $${params.length - 1} OR da.state ILIKE $${params.length})`;
    }

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

      const dataParams = [...params, pageSize, offset];
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
        period: { from: period.from.toISOString(), to: period.to.toISOString() },
        page,
        pageSize,
        total: Number(count.rows[0]?.total ?? '0'),
        rows: result.rows.map((row) => ({
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
        })),
        generatedAt: new Date().toISOString(),
      };
    });
  }
}

function parsePeriod(query: OperationalReportQuery): { from: Date; to: Date } {
  const to = parseDate(query.to, 'to') ?? new Date();
  const from = parseDate(query.from, 'from') ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (from >= to) throw new BadRequestException('from must be earlier than to');
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new BadRequestException('report period cannot exceed 366 days');
  }
  return { from, to };
}

function parseDate(value: string | undefined, field: string): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} must be a valid ISO date or timestamp`);
  return date;
}

function parsePositiveInt(value: string | undefined, field: string, fallback: number, max: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new BadRequestException(`${field} must be an integer between 1 and ${max}`);
  }
  return parsed;
}
