import { BadRequestException, Injectable } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';

export interface FinancialAnalyticsQuery {
  readonly from?: string;
  readonly to?: string;
  readonly customerPartyId?: string;
}

export interface FinancialIndicatorCustomerOption {
  readonly id: string;
  readonly name: string;
}

export interface FinancialIndicatorCurrency {
  readonly currencyCode: string;
  readonly plannedRevenueAmount: string;
  readonly invoicedRevenueAmount: string;
  readonly contractedCostAmount: string;
  readonly marginAmount: string;
  readonly marginPercentage: string | null;
  readonly operationCount: number;
  readonly contractedOperationCount: number;
  readonly marginEligibleOperationCount: number;
  readonly invoicedReceivableCount: number;
}

export interface FinancialIndicatorsSnapshot {
  readonly period: {
    readonly from: string;
    readonly to: string;
  };
  readonly customerPartyId: string | null;
  readonly customers: readonly FinancialIndicatorCustomerOption[];
  readonly byCurrency: readonly FinancialIndicatorCurrency[];
  readonly reconciliation: {
    readonly plannedRevenue: string;
    readonly invoicedRevenue: string;
    readonly contractedCost: string;
    readonly margin: string;
  };
  readonly generatedAt: string;
}

interface FinancialIndicatorRow {
  readonly currencyCode: string;
  readonly plannedRevenueAmount: string;
  readonly invoicedRevenueAmount: string;
  readonly contractedCostAmount: string;
  readonly marginAmount: string;
  readonly marginPercentage: string | null;
  readonly operationCount: string;
  readonly contractedOperationCount: string;
  readonly marginEligibleOperationCount: string;
  readonly invoicedReceivableCount: string;
}

interface CustomerOptionRow {
  readonly id: string;
  readonly name: string;
}

interface ParsedFinancialAnalyticsQuery {
  readonly from: Date;
  readonly to: Date;
  readonly customerPartyId: string | null;
}

@Injectable()
export class FinancialAnalyticsService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  getFinancialIndicators(query: FinancialAnalyticsQuery): Promise<FinancialIndicatorsSnapshot> {
    const parsed = parseFinancialAnalyticsQuery(query);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const values = [
        parsed.from.toISOString(),
        parsed.to.toISOString(),
        parsed.customerPartyId,
      ];
      const indicators = await client.query<FinancialIndicatorRow>(financialIndicatorsSql(), values);
      const customerOptions = await client.query<CustomerOptionRow>(customerOptionsSql(), [
        parsed.from.toISOString(),
        parsed.to.toISOString(),
      ]);

      return {
        period: {
          from: parsed.from.toISOString(),
          to: parsed.to.toISOString(),
        },
        customerPartyId: parsed.customerPartyId,
        customers: customerOptions.rows,
        byCurrency: indicators.rows.map((row) => ({
          currencyCode: row.currencyCode,
          plannedRevenueAmount: row.plannedRevenueAmount,
          invoicedRevenueAmount: row.invoicedRevenueAmount,
          contractedCostAmount: row.contractedCostAmount,
          marginAmount: row.marginAmount,
          marginPercentage: row.marginPercentage,
          operationCount: toCount(row.operationCount),
          contractedOperationCount: toCount(row.contractedOperationCount),
          marginEligibleOperationCount: toCount(row.marginEligibleOperationCount),
          invoicedReceivableCount: toCount(row.invoicedReceivableCount),
        })),
        reconciliation: {
          plannedRevenue:
            'transport_request_commercial_terms.customer_price filtered by transport_requests.created_at',
          invoicedRevenue:
            'customer_receivables.invoiced_amount excluding cancelled receivables, filtered by receivable created_at',
          contractedCost:
            'latest confirmed or fulfilled transport_contract per request: freight + toll + additional',
          margin:
            'customer_price minus contracted cost only when revenue and contract currencies match',
        },
        generatedAt: new Date().toISOString(),
      };
    });
  }
}

export function parseFinancialAnalyticsQuery(
  query: FinancialAnalyticsQuery,
): ParsedFinancialAnalyticsQuery {
  const to = parseDate(query.to, 'to') ?? new Date();
  const from =
    parseDate(query.from, 'from') ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const customerPartyId = parseOptionalUuid(query.customerPartyId, 'customerPartyId');

  if (from >= to) {
    throw new BadRequestException('from must be earlier than to');
  }
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new BadRequestException('analytics period cannot exceed 366 days');
  }

  return { from, to, customerPartyId };
}

function parseDate(value: string | undefined, field: string): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid ISO date or timestamp`);
  }
  return date;
}

function parseOptionalUuid(value: string | undefined, field: string): string | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      normalized,
    )
  ) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return normalized;
}

function toCount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function financialIndicatorsSql(): string {
  return `WITH request_scope AS (
    SELECT r.id,
           r.customer_party_id,
           terms.currency_code AS revenue_currency_code,
           terms.customer_price,
           contract.id AS contract_id,
           contract.currency_code AS cost_currency_code,
           contract.total_cost_amount
      FROM transport_requests r
      JOIN transport_request_commercial_terms terms
        ON terms.tenant_id=r.tenant_id AND terms.transport_request_id=r.id
      LEFT JOIN LATERAL (
        SELECT c.id,
               c.currency_code,
               (c.freight_amount+c.toll_amount+c.additional_amount)::numeric(14,2) AS total_cost_amount
          FROM transport_contracts c
         WHERE c.tenant_id=r.tenant_id
           AND c.transport_request_id=r.id
           AND c.status IN ('confirmed','fulfilled')
         ORDER BY CASE WHEN c.status='confirmed' THEN 0 ELSE 1 END,
                  coalesce(c.confirmed_at,c.fulfilled_at,c.created_at) DESC,
                  c.id DESC
         LIMIT 1
      ) contract ON true
     WHERE r.created_at >= $1::timestamptz
       AND r.created_at < $2::timestamptz
       AND ($3::uuid IS NULL OR r.customer_party_id=$3::uuid)
  ), planned AS (
    SELECT revenue_currency_code AS currency_code,
           count(*)::bigint AS operation_count,
           coalesce(sum(customer_price),0)::numeric(16,2) AS planned_revenue_amount
      FROM request_scope
     GROUP BY revenue_currency_code
  ), contracted AS (
    SELECT cost_currency_code AS currency_code,
           count(*)::bigint AS contracted_operation_count,
           coalesce(sum(total_cost_amount),0)::numeric(16,2) AS contracted_cost_amount
      FROM request_scope
     WHERE contract_id IS NOT NULL
     GROUP BY cost_currency_code
  ), margin AS (
    SELECT revenue_currency_code AS currency_code,
           count(*)::bigint AS margin_eligible_operation_count,
           coalesce(sum(customer_price),0)::numeric(16,2) AS margin_revenue_amount,
           coalesce(sum(customer_price-total_cost_amount),0)::numeric(16,2) AS margin_amount
      FROM request_scope
     WHERE contract_id IS NOT NULL
       AND customer_price IS NOT NULL
       AND revenue_currency_code=cost_currency_code
     GROUP BY revenue_currency_code
  ), invoiced AS (
    SELECT rcv.currency_code,
           count(*)::bigint AS invoiced_receivable_count,
           coalesce(sum(rcv.invoiced_amount),0)::numeric(16,2) AS invoiced_revenue_amount
      FROM customer_receivables rcv
     WHERE rcv.created_at >= $1::timestamptz
       AND rcv.created_at < $2::timestamptz
       AND rcv.status <> 'cancelled'
       AND ($3::uuid IS NULL OR rcv.customer_party_id=$3::uuid)
     GROUP BY rcv.currency_code
  ), currencies AS (
    SELECT currency_code FROM planned
    UNION SELECT currency_code FROM contracted
    UNION SELECT currency_code FROM margin
    UNION SELECT currency_code FROM invoiced
  )
  SELECT currencies.currency_code AS "currencyCode",
         coalesce(planned.planned_revenue_amount,0)::numeric(16,2)::text AS "plannedRevenueAmount",
         coalesce(invoiced.invoiced_revenue_amount,0)::numeric(16,2)::text AS "invoicedRevenueAmount",
         coalesce(contracted.contracted_cost_amount,0)::numeric(16,2)::text AS "contractedCostAmount",
         coalesce(margin.margin_amount,0)::numeric(16,2)::text AS "marginAmount",
         CASE
           WHEN coalesce(margin.margin_revenue_amount,0)=0 THEN NULL
           ELSE round((margin.margin_amount/margin.margin_revenue_amount)*100,2)::text
         END AS "marginPercentage",
         coalesce(planned.operation_count,0)::text AS "operationCount",
         coalesce(contracted.contracted_operation_count,0)::text AS "contractedOperationCount",
         coalesce(margin.margin_eligible_operation_count,0)::text AS "marginEligibleOperationCount",
         coalesce(invoiced.invoiced_receivable_count,0)::text AS "invoicedReceivableCount"
    FROM currencies
    LEFT JOIN planned USING (currency_code)
    LEFT JOIN contracted USING (currency_code)
    LEFT JOIN margin USING (currency_code)
    LEFT JOIN invoiced USING (currency_code)
   ORDER BY currencies.currency_code`;
}

function customerOptionsSql(): string {
  return `SELECT p.id::text AS id,p.legal_name AS name
    FROM business_parties p
   WHERE EXISTS (
           SELECT 1
             FROM transport_requests r
            WHERE r.customer_party_id=p.id
              AND r.created_at >= $1::timestamptz
              AND r.created_at < $2::timestamptz
         )
      OR EXISTS (
           SELECT 1
             FROM customer_receivables rcv
            WHERE rcv.customer_party_id=p.id
              AND rcv.created_at >= $1::timestamptz
              AND rcv.created_at < $2::timestamptz
              AND rcv.status <> 'cancelled'
         )
   ORDER BY p.legal_name,p.id`;
}
