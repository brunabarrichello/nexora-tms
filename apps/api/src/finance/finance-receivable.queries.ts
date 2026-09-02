export function receivableProjectionSql(): string {
  return `WITH totals AS (
    SELECT receivable_id,
           coalesce(sum(CASE WHEN kind='receipt' THEN amount ELSE 0 END),0)::numeric(14,2) AS receipt_amount,
           coalesce(sum(CASE WHEN kind='reversal' THEN amount ELSE 0 END),0)::numeric(14,2) AS reversal_amount
      FROM customer_receivable_transactions
     GROUP BY receivable_id
  )
  SELECT rcv.id::text AS id,
         rcv.transport_request_id::text AS "transportRequestId",
         rcv.customer_party_id::text AS "customerPartyId",
         customer.legal_name AS "customerName",
         request.cargo_description AS "cargoDescription",
         rcv.currency_code AS "currencyCode",
         rcv.invoiced_amount::text AS "invoicedAmount",
         coalesce(t.receipt_amount,0)::text AS "receiptAmount",
         coalesce(t.reversal_amount,0)::text AS "reversalAmount",
         (coalesce(t.receipt_amount,0)-coalesce(t.reversal_amount,0))::numeric(14,2)::text AS "receivedAmount",
         greatest(rcv.invoiced_amount-(coalesce(t.receipt_amount,0)-coalesce(t.reversal_amount,0)),0)::numeric(14,2)::text AS "balanceAmount",
         rcv.due_at AS "dueAt",
         rcv.status AS status,
         CASE
           WHEN rcv.status='cancelled' THEN 'cancelled'
           WHEN rcv.status='paid' THEN 'paid'
           WHEN rcv.due_at < now() THEN 'overdue'
           ELSE rcv.status
         END AS "effectiveStatus",
         rcv.fiscal_document_id::text AS "fiscalDocumentId",
         fiscal.title AS "fiscalDocumentTitle",
         rcv.fiscal_reference AS "fiscalReference",
         rcv.notes,
         rcv.cancel_reason AS "cancelReason",
         rcv.created_at AS "createdAt",
         rcv.updated_at AS "updatedAt"
    FROM customer_receivables rcv
    JOIN transport_requests request ON request.tenant_id=rcv.tenant_id AND request.id=rcv.transport_request_id
    JOIN business_parties customer ON customer.tenant_id=rcv.tenant_id AND customer.id=rcv.customer_party_id
    LEFT JOIN documents fiscal ON fiscal.tenant_id=rcv.tenant_id AND fiscal.id=rcv.fiscal_document_id
    LEFT JOIN totals t ON t.receivable_id=rcv.id
   WHERE true`;
}

export function receivableTransactionProjectionSql(where: string): string {
  return `SELECT t.id::text AS id,
                 t.receivable_id::text AS "receivableId",
                 t.kind,
                 t.amount::text AS amount,
                 t.related_transaction_id::text AS "relatedTransactionId",
                 t.proof_document_id::text AS "proofDocumentId",
                 proof.title AS "proofDocumentTitle",
                 t.occurred_at AS "occurredAt",
                 t.notes,
                 t.created_by_user_id::text AS "createdByUserId",
                 t.created_at AS "createdAt"
            FROM customer_receivable_transactions t
            LEFT JOIN documents proof ON proof.tenant_id=t.tenant_id AND proof.id=t.proof_document_id
            ${where}`;
}
