import type { CommercialTermsStatus } from './transport-commercial.validation.js';

export interface CommercialRow {
  readonly id: string;
  readonly transport_request_id: string;
  readonly currency_code: string;
  readonly customer_price: string | null;
  readonly target_carrier_freight: string;
  readonly toll_amount: string;
  readonly additional_amount: string;
  readonly payment_terms: string;
  readonly commercial_notes: string | null;
  readonly status: CommercialTermsStatus;
  readonly approval_note: string | null;
  readonly approved_by_user_id: string | null;
  readonly approved_at: Date | null;
  readonly version: number;
  readonly created_by_user_id: string;
  readonly updated_by_user_id: string;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface CommercialHistoryRow {
  readonly id: string;
  readonly version: number;
  readonly event_type: string;
  readonly status: CommercialTermsStatus;
  readonly actor_user_id: string;
  readonly snapshot: Record<string, unknown>;
  readonly note: string | null;
  readonly created_at: Date;
}

export interface CommercialTermsView {
  readonly id: string;
  readonly transportRequestId: string;
  readonly currencyCode: string;
  readonly customerPrice: string | null;
  readonly targetCarrierFreight: string;
  readonly tollAmount: string;
  readonly additionalAmount: string;
  readonly targetTotalCost: string;
  readonly estimatedMargin: string | null;
  readonly paymentTerms: string;
  readonly commercialNotes: string | null;
  readonly status: CommercialTermsStatus;
  readonly negotiationReleased: boolean;
  readonly approvalNote: string | null;
  readonly approvedByUserId: string | null;
  readonly approvedAt: string | null;
  readonly version: number;
  readonly createdByUserId: string;
  readonly updatedByUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CommercialHistoryView {
  readonly id: string;
  readonly version: number;
  readonly eventType: string;
  readonly status: CommercialTermsStatus;
  readonly actorUserId: string;
  readonly snapshot: Record<string, unknown>;
  readonly note: string | null;
  readonly createdAt: string;
}

export const COMMERCIAL_COLUMNS = `
  id::text AS id,
  transport_request_id::text AS transport_request_id,
  currency_code,
  customer_price::text AS customer_price,
  target_carrier_freight::text AS target_carrier_freight,
  toll_amount::text AS toll_amount,
  additional_amount::text AS additional_amount,
  payment_terms,
  commercial_notes,
  status::text AS status,
  approval_note,
  approved_by_user_id::text AS approved_by_user_id,
  approved_at,
  version,
  created_by_user_id::text AS created_by_user_id,
  updated_by_user_id::text AS updated_by_user_id,
  created_at,
  updated_at`;

export function mapCommercialTerms(row: CommercialRow): CommercialTermsView {
  const targetTotal =
    Number(row.target_carrier_freight) + Number(row.toll_amount) + Number(row.additional_amount);
  const margin = row.customer_price === null ? null : Number(row.customer_price) - targetTotal;
  return {
    id: row.id,
    transportRequestId: row.transport_request_id,
    currencyCode: row.currency_code,
    customerPrice: row.customer_price,
    targetCarrierFreight: row.target_carrier_freight,
    tollAmount: row.toll_amount,
    additionalAmount: row.additional_amount,
    targetTotalCost: targetTotal.toFixed(2),
    estimatedMargin: margin === null ? null : margin.toFixed(2),
    paymentTerms: row.payment_terms,
    commercialNotes: row.commercial_notes,
    status: row.status,
    negotiationReleased: row.status === 'approved',
    approvalNote: row.approval_note,
    approvedByUserId: row.approved_by_user_id,
    approvedAt: row.approved_at?.toISOString() ?? null,
    version: row.version,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapCommercialHistory(row: CommercialHistoryRow): CommercialHistoryView {
  return {
    id: row.id,
    version: row.version,
    eventType: row.event_type,
    status: row.status,
    actorUserId: row.actor_user_id,
    snapshot: row.snapshot,
    note: row.note,
    createdAt: row.created_at.toISOString(),
  };
}
