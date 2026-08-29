import { NotFoundException } from '@nestjs/common';

import type { TenantQueryClient } from '../tenancy/tenant-database.service.js';
import type {
  CommercialTermsInput,
  CommercialTermsStatus,
} from './transport-commercial.validation.js';
import {
  COMMERCIAL_COLUMNS,
  mapCommercialHistory,
  mapCommercialTerms,
  type CommercialHistoryRow,
  type CommercialHistoryView,
  type CommercialRow,
} from './transport-commercial.models.js';

export async function loadCommercialTerms(
  client: TenantQueryClient,
  requestId: string,
): Promise<CommercialRow | null> {
  const result = await client.query<CommercialRow>(
    `SELECT ${COMMERCIAL_COLUMNS}
       FROM transport_request_commercial_terms
      WHERE transport_request_id=$1::uuid`,
    [requestId],
  );
  return result.rows[0] ?? null;
}

export async function loadCommercialHistory(
  client: TenantQueryClient,
  requestId: string,
): Promise<CommercialHistoryView[]> {
  const result = await client.query<CommercialHistoryRow>(
    `SELECT id::text AS id, version, event_type, status::text AS status,
            actor_user_id::text AS actor_user_id, snapshot, note, created_at
       FROM transport_request_commercial_history
      WHERE transport_request_id=$1::uuid
      ORDER BY version ASC`,
    [requestId],
  );
  return result.rows.map(mapCommercialHistory);
}

export async function createCommercialTerms(
  client: TenantQueryClient,
  tenantId: string,
  userId: string,
  requestId: string,
  terms: CommercialTermsInput,
): Promise<CommercialRow> {
  const result = await client.query<CommercialRow>(
    `INSERT INTO transport_request_commercial_terms (
       tenant_id,transport_request_id,currency_code,customer_price,target_carrier_freight,
       toll_amount,additional_amount,payment_terms,commercial_notes,created_by_user_id,updated_by_user_id
     ) VALUES ($1::uuid,$2::uuid,$3,$4::numeric,$5::numeric,$6::numeric,$7::numeric,$8,$9,$10::uuid,$10::uuid)
     RETURNING ${COMMERCIAL_COLUMNS}`,
    [
      tenantId,
      requestId,
      terms.currencyCode,
      terms.customerPrice,
      terms.targetCarrierFreight,
      terms.tollAmount,
      terms.additionalAmount,
      terms.paymentTerms,
      terms.commercialNotes,
      userId,
    ],
  );
  return requireCommercialRow(result.rows[0]);
}

export async function updateCommercialTerms(
  client: TenantQueryClient,
  userId: string,
  requestId: string,
  version: number,
  terms: CommercialTermsInput,
): Promise<CommercialRow> {
  const result = await client.query<CommercialRow>(
    `UPDATE transport_request_commercial_terms
        SET currency_code=$1, customer_price=$2::numeric, target_carrier_freight=$3::numeric,
            toll_amount=$4::numeric, additional_amount=$5::numeric, payment_terms=$6,
            commercial_notes=$7, status='draft', approval_note=NULL,
            approved_by_user_id=NULL, approved_at=NULL, updated_by_user_id=$8::uuid,
            version=$9, updated_at=now()
      WHERE transport_request_id=$10::uuid
      RETURNING ${COMMERCIAL_COLUMNS}`,
    [
      terms.currencyCode,
      terms.customerPrice,
      terms.targetCarrierFreight,
      terms.tollAmount,
      terms.additionalAmount,
      terms.paymentTerms,
      terms.commercialNotes,
      userId,
      version,
      requestId,
    ],
  );
  return requireCommercialRow(result.rows[0]);
}

export async function changeCommercialStatus(
  client: TenantQueryClient,
  requestId: string,
  userId: string,
  status: Exclude<CommercialTermsStatus, 'draft'>,
  note: string | null,
): Promise<CommercialRow> {
  const result = await client.query<CommercialRow>(
    `UPDATE transport_request_commercial_terms
        SET status=$1::commercial_terms_status,
            approval_note=$2,
            approved_by_user_id=CASE WHEN $1='approved' THEN $3::uuid ELSE NULL END,
            approved_at=CASE WHEN $1='approved' THEN now() ELSE NULL END,
            updated_by_user_id=$3::uuid,
            version=version+1,
            updated_at=now()
      WHERE transport_request_id=$4::uuid
      RETURNING ${COMMERCIAL_COLUMNS}`,
    [status, note, userId, requestId],
  );
  return requireCommercialRow(result.rows[0]);
}

export async function appendCommercialHistory(
  client: TenantQueryClient,
  tenantId: string,
  actorUserId: string,
  row: CommercialRow,
  eventType: string,
  note: string | null,
): Promise<void> {
  await client.query(
    `INSERT INTO transport_request_commercial_history (
       tenant_id,transport_request_id,commercial_terms_id,version,event_type,status,actor_user_id,snapshot,note
     ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::commercial_terms_status,$7::uuid,$8::jsonb,$9)`,
    [
      tenantId,
      row.transport_request_id,
      row.id,
      row.version,
      eventType,
      row.status,
      actorUserId,
      JSON.stringify(mapCommercialTerms(row)),
      note,
    ],
  );
}

function requireCommercialRow(row: CommercialRow | undefined): CommercialRow {
  if (!row) throw new NotFoundException('Commercial terms were not persisted');
  return row;
}
