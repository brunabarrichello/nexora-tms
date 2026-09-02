export type CustomerReceivableStatus = 'open' | 'partially_received' | 'paid' | 'cancelled';
export type CustomerReceivableEffectiveStatus = CustomerReceivableStatus | 'overdue';
export type CustomerReceivableTransactionKind = 'receipt' | 'reversal';

export interface CustomerReceivableRecord {
  readonly id: string;
  readonly transportRequestId: string;
  readonly customerPartyId: string;
  readonly customerName: string;
  readonly cargoDescription: string;
  readonly currencyCode: string;
  readonly invoicedAmount: string;
  readonly receiptAmount: string;
  readonly reversalAmount: string;
  readonly receivedAmount: string;
  readonly balanceAmount: string;
  readonly dueAt: string;
  readonly status: CustomerReceivableStatus;
  readonly effectiveStatus: CustomerReceivableEffectiveStatus;
  readonly fiscalDocumentId: string | null;
  readonly fiscalDocumentTitle: string | null;
  readonly fiscalReference: string | null;
  readonly notes: string | null;
  readonly cancelReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerReceivableTransactionRecord {
  readonly id: string;
  readonly receivableId: string;
  readonly kind: CustomerReceivableTransactionKind;
  readonly amount: string;
  readonly relatedTransactionId: string | null;
  readonly proofDocumentId: string | null;
  readonly proofDocumentTitle: string | null;
  readonly occurredAt: string;
  readonly notes: string | null;
  readonly createdByUserId: string;
  readonly createdAt: string;
}

export interface CustomerReceivableEventRecord {
  readonly id: string;
  readonly receivableId: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly actorUserId: string;
  readonly createdAt: string;
}
