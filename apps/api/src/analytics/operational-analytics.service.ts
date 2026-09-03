import { BadRequestException, Injectable } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';

interface OperationalDashboardQuery {
  readonly from?: string;
  readonly to?: string;
}

export interface OperationalDashboardSnapshot {
  readonly period: {
    readonly from: string;
    readonly to: string;
  };
  readonly transportRequests: {
    readonly total: number;
    readonly byStatus: Readonly<Record<string, number>>;
    readonly withoutContract: number;
  };
  readonly trips: {
    readonly total: number;
    readonly byStatus: Readonly<Record<string, number>>;
    readonly inProgress: number;
    readonly overdue: number;
  };
  readonly occurrences: {
    readonly open: number;
    readonly criticalOpen: number;
  };
  readonly documents: {
    readonly blockingFindings: number;
  };
  readonly generatedAt: string;
}

interface DashboardRow {
  readonly transportRequestTotal: string;
  readonly transportRequestByStatus: Record<string, number> | null;
  readonly transportRequestWithoutContract: string;
  readonly tripTotal: string;
  readonly tripByStatus: Record<string, number> | null;
  readonly tripInProgress: string;
  readonly tripOverdue: string;
  readonly occurrenceOpen: string;
  readonly occurrenceCriticalOpen: string;
  readonly documentBlockingFindings: string;
}

@Injectable()
export class OperationalAnalyticsService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  getOperationalDashboard(query: OperationalDashboardQuery): Promise<OperationalDashboardSnapshot> {
    const period = parsePeriod(query);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<DashboardRow>(
        `WITH request_scope AS (
           SELECT r.id,r.status
             FROM transport_requests r
            WHERE r.created_at >= $1::timestamptz
              AND r.created_at < $2::timestamptz
         ), request_status AS (
           SELECT status::text AS status,count(*)::int AS count
             FROM request_scope
            GROUP BY status
         ), trip_scope AS (
           SELECT t.id,t.status,t.planned_end_at
             FROM trips t
            WHERE t.planned_start_at >= $1::timestamptz
              AND t.planned_start_at < $2::timestamptz
         ), trip_status AS (
           SELECT status::text AS status,count(*)::int AS count
             FROM trip_scope
            GROUP BY status
         ), occurrence_scope AS (
           SELECT o.status,o.severity
             FROM trip_occurrences o
            WHERE o.occurred_at >= $1::timestamptz
              AND o.occurred_at < $2::timestamptz
         ), document_blockers AS (
           SELECT 1
             FROM business_parties subject
             CROSS JOIN LATERAL nexora_evaluate_document_compliance('party',subject.id,'contracting') finding
            WHERE finding.blocking
           UNION ALL
           SELECT 1
             FROM drivers subject
             CROSS JOIN LATERAL nexora_evaluate_document_compliance('driver',subject.id,'contracting') finding
            WHERE finding.blocking
           UNION ALL
           SELECT 1
             FROM capacity_assets subject
             CROSS JOIN LATERAL nexora_evaluate_document_compliance('asset',subject.id,'contracting') finding
            WHERE finding.blocking
           UNION ALL
           SELECT 1
             FROM business_parties subject
             CROSS JOIN LATERAL nexora_evaluate_document_compliance('party',subject.id,'trip') finding
            WHERE finding.blocking
           UNION ALL
           SELECT 1
             FROM drivers subject
             CROSS JOIN LATERAL nexora_evaluate_document_compliance('driver',subject.id,'trip') finding
            WHERE finding.blocking
           UNION ALL
           SELECT 1
             FROM capacity_assets subject
             CROSS JOIN LATERAL nexora_evaluate_document_compliance('asset',subject.id,'trip') finding
            WHERE finding.blocking
         )
         SELECT
           (SELECT count(*) FROM request_scope)::text AS "transportRequestTotal",
           coalesce((SELECT jsonb_object_agg(status,count) FROM request_status),'{}'::jsonb) AS "transportRequestByStatus",
           (SELECT count(*)
              FROM request_scope r
             WHERE NOT EXISTS (
               SELECT 1
                 FROM transport_contracts c
                WHERE c.transport_request_id=r.id
                  AND c.status IN ('confirmed','fulfilled')
             ))::text AS "transportRequestWithoutContract",
           (SELECT count(*) FROM trip_scope)::text AS "tripTotal",
           coalesce((SELECT jsonb_object_agg(status,count) FROM trip_status),'{}'::jsonb) AS "tripByStatus",
           (SELECT count(*) FROM trip_scope WHERE status='in_transit')::text AS "tripInProgress",
           (SELECT count(*)
              FROM trip_scope
             WHERE status IN ('planned','ready','in_transit')
               AND planned_end_at IS NOT NULL
               AND planned_end_at < clock_timestamp())::text AS "tripOverdue",
           (SELECT count(*) FROM occurrence_scope WHERE status='open')::text AS "occurrenceOpen",
           (SELECT count(*) FROM occurrence_scope WHERE status='open' AND severity='critical')::text AS "occurrenceCriticalOpen",
           (SELECT count(*) FROM document_blockers)::text AS "documentBlockingFindings"`,
        [period.from.toISOString(), period.to.toISOString()],
      );

      const row = result.rows[0];
      return {
        period: {
          from: period.from.toISOString(),
          to: period.to.toISOString(),
        },
        transportRequests: {
          total: toCount(row?.transportRequestTotal),
          byStatus: normalizeCounts(row?.transportRequestByStatus),
          withoutContract: toCount(row?.transportRequestWithoutContract),
        },
        trips: {
          total: toCount(row?.tripTotal),
          byStatus: normalizeCounts(row?.tripByStatus),
          inProgress: toCount(row?.tripInProgress),
          overdue: toCount(row?.tripOverdue),
        },
        occurrences: {
          open: toCount(row?.occurrenceOpen),
          criticalOpen: toCount(row?.occurrenceCriticalOpen),
        },
        documents: {
          blockingFindings: toCount(row?.documentBlockingFindings),
        },
        generatedAt: new Date().toISOString(),
      };
    });
  }
}

function parsePeriod(query: OperationalDashboardQuery): { from: Date; to: Date } {
  const to = parseDate(query.to, 'to') ?? new Date();
  const from = parseDate(query.from, 'from') ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (from >= to) {
    throw new BadRequestException('from must be earlier than to');
  }
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new BadRequestException('analytics period cannot exceed 366 days');
  }
  return { from, to };
}

function parseDate(value: string | undefined, field: string): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid ISO date or timestamp`);
  }
  return date;
}

function toCount(value: string | undefined): number {
  const parsed = Number(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCounts(
  value: Record<string, number> | null | undefined,
): Readonly<Record<string, number>> {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, count]) => [
      key,
      Number.isFinite(Number(count)) ? Number(count) : 0,
    ]),
  );
}
