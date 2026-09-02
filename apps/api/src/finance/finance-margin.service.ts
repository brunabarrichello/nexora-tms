import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';

export interface OperationMarginRecord {
  readonly transportRequestId: string;
  readonly transportRequestStatus: string;
  readonly cargoDescription: string;
  readonly customerName: string;
  readonly stage: 'planned' | 'contracted';
  readonly currencyCode: string;
  readonly costCurrencyCode: string;
  readonly currencyConsistent: boolean;
  readonly revenueAmount: string | null;
  readonly carrierFreightAmount: string;
  readonly tollAmount: string;
  readonly additionalAmount: string;
  readonly totalCostAmount: string;
  readonly marginAmount: string | null;
  readonly marginPercentage: string | null;
  readonly commercialTermsId: string;
  readonly commercialTermsStatus: string;
  readonly contractId: string | null;
  readonly contractStatus: string | null;
}

@Injectable()
export class FinanceMarginService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  list(): Promise<readonly OperationMarginRecord[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<OperationMarginRecord>(
        `${marginProjectionSql()}
          ORDER BY request_id`,
      );
      return result.rows;
    });
  }

  async get(transportRequestIdValue: string): Promise<OperationMarginRecord> {
    const transportRequestId = requireUuid(transportRequestIdValue, 'transportRequestId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<OperationMarginRecord>(
        `${marginProjectionSql()}
          AND request_id=$1::uuid
          LIMIT 1`,
        [transportRequestId],
      );
      const row = result.rows[0];
      if (!row) {
        throw new NotFoundException(
          'financial margin projection not found for transport request in current tenant',
        );
      }
      return row;
    });
  }
}

function requireUuid(value: string, field: string): string {
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

function marginProjectionSql(): string {
  return `WITH margin_source AS (
    SELECT r.id AS request_id,
           r.status::text AS request_status,
           r.cargo_description,
           customer.legal_name AS customer_name,
           terms.id AS commercial_terms_id,
           terms.status::text AS commercial_terms_status,
           terms.currency_code AS revenue_currency_code,
           terms.customer_price,
           contract.id AS contract_id,
           contract.status::text AS contract_status,
           coalesce(contract.currency_code,terms.currency_code) AS cost_currency_code,
           coalesce(contract.freight_amount,terms.target_carrier_freight) AS carrier_freight_amount,
           coalesce(contract.toll_amount,terms.toll_amount) AS toll_amount,
           coalesce(contract.additional_amount,terms.additional_amount) AS additional_amount
      FROM transport_requests r
      JOIN transport_request_commercial_terms terms
        ON terms.tenant_id=r.tenant_id AND terms.transport_request_id=r.id
      JOIN business_parties customer
        ON customer.tenant_id=r.tenant_id AND customer.id=r.customer_party_id
      LEFT JOIN LATERAL (
        SELECT c.id,c.status,c.currency_code,c.freight_amount,c.toll_amount,c.additional_amount
          FROM transport_contracts c
         WHERE c.tenant_id=r.tenant_id
           AND c.transport_request_id=r.id
           AND c.status IN ('confirmed','fulfilled')
         ORDER BY CASE WHEN c.status='confirmed' THEN 0 ELSE 1 END,
                  coalesce(c.confirmed_at,c.fulfilled_at,c.created_at) DESC,
                  c.id DESC
         LIMIT 1
      ) contract ON true
  ), calculated AS (
    SELECT m.*,
           (m.carrier_freight_amount+m.toll_amount+m.additional_amount) AS total_cost_amount,
           (m.revenue_currency_code=m.cost_currency_code) AS currency_consistent
      FROM margin_source m
  )
  SELECT request_id::text AS "transportRequestId",
         request_status AS "transportRequestStatus",
         cargo_description AS "cargoDescription",
         customer_name AS "customerName",
         CASE WHEN contract_id IS NULL THEN 'planned' ELSE 'contracted' END AS stage,
         revenue_currency_code AS "currencyCode",
         cost_currency_code AS "costCurrencyCode",
         currency_consistent AS "currencyConsistent",
         customer_price::text AS "revenueAmount",
         carrier_freight_amount::text AS "carrierFreightAmount",
         toll_amount::text AS "tollAmount",
         additional_amount::text AS "additionalAmount",
         total_cost_amount::text AS "totalCostAmount",
         CASE
           WHEN customer_price IS NULL OR NOT currency_consistent THEN NULL
           ELSE round(customer_price-total_cost_amount,2)::text
         END AS "marginAmount",
         CASE
           WHEN customer_price IS NULL OR customer_price=0 OR NOT currency_consistent THEN NULL
           ELSE round(((customer_price-total_cost_amount)/customer_price)*100,2)::text
         END AS "marginPercentage",
         commercial_terms_id::text AS "commercialTermsId",
         commercial_terms_status AS "commercialTermsStatus",
         contract_id::text AS "contractId",
         contract_status AS "contractStatus"
    FROM calculated
   WHERE true`;
}
