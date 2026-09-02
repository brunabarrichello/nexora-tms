export function obligationProjectionSql(): string {
  return `WITH transaction_totals AS (
    SELECT tenant_id,obligation_id,
           coalesce(sum(amount) FILTER (WHERE kind='advance'),0)::numeric(14,2) AS advance_amount,
           coalesce(sum(amount) FILTER (WHERE kind='payment'),0)::numeric(14,2) AS payment_amount,
           coalesce(sum(amount) FILTER (WHERE kind='reversal'),0)::numeric(14,2) AS reversal_amount
      FROM carrier_payment_transactions
     GROUP BY tenant_id,obligation_id
  )
  SELECT o.id::text AS id,
         o.transport_request_id::text AS "transportRequestId",
         o.transport_contract_id::text AS "transportContractId",
         o.trip_id::text AS "tripId",tr.code AS "tripCode",
         o.carrier_party_id::text AS "carrierPartyId",bp.legal_name AS "carrierName",
         r.cargo_description AS "cargoDescription",
         o.currency_code AS "currencyCode",o.contracted_amount::text AS "contractedAmount",
         coalesce(tt.advance_amount,0)::text AS "advanceAmount",
         coalesce(tt.payment_amount,0)::text AS "paymentAmount",
         coalesce(tt.reversal_amount,0)::text AS "reversalAmount",
         (coalesce(tt.advance_amount,0)+coalesce(tt.payment_amount,0)-coalesce(tt.reversal_amount,0))::numeric(14,2)::text AS "settledAmount",
         (o.contracted_amount-(coalesce(tt.advance_amount,0)+coalesce(tt.payment_amount,0)-coalesce(tt.reversal_amount,0)))::numeric(14,2)::text AS "balanceAmount",
         o.due_at AS "dueAt",o.status,
         CASE WHEN o.status='cancelled' THEN 'cancelled'
              WHEN o.status='paid' THEN 'paid'
              WHEN o.due_at < clock_timestamp() THEN 'overdue'
              ELSE o.status END AS "effectiveStatus",
         o.notes,o.cancel_reason AS "cancelReason",o.cancelled_at AS "cancelledAt",
         o.created_at AS "createdAt",o.updated_at AS "updatedAt"
    FROM carrier_payment_obligations o
    JOIN transport_requests r ON r.tenant_id=o.tenant_id AND r.id=o.transport_request_id
    JOIN business_parties bp ON bp.tenant_id=o.tenant_id AND bp.id=o.carrier_party_id
    LEFT JOIN trips tr ON tr.tenant_id=o.tenant_id AND tr.id=o.trip_id
    LEFT JOIN transaction_totals tt ON tt.tenant_id=o.tenant_id AND tt.obligation_id=o.id
   WHERE true`;
}

export function transactionProjectionSql(suffix: string): string {
  return `SELECT t.id::text AS id,t.obligation_id::text AS "obligationId",t.kind,t.amount::text AS amount,
                 t.related_transaction_id::text AS "relatedTransactionId",
                 t.proof_document_id::text AS "proofDocumentId",d.title AS "proofDocumentTitle",
                 d.status AS "proofDocumentStatus",t.occurred_at AS "occurredAt",t.notes,
                 t.created_by_user_id::text AS "createdByUserId",t.created_at AS "createdAt"
            FROM carrier_payment_transactions t
            LEFT JOIN documents d ON d.tenant_id=t.tenant_id AND d.id=t.proof_document_id
           ${suffix}`;
}
