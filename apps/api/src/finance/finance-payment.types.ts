export interface CarrierPaymentObligationRecord {
  readonly id: string;
  readonly transportRequestId: string;
  readonly transportContractId: string;
  readonly tripId: string | null;
  readonly tripCode: string | null;
  readonly carrierPartyId: string;
  readonly carrierName: string;
  readonly cargoDescription: string;
  readonly currencyCode: string;
  readonly contractedAmount: string;
  readonly advanceAmount: string;
  readonly paymentAmount: string;
  readonly reversalAmount: string;
  readonly settledAmount: string;
  readonly balanceAmount: string;
  readonly dueAt: Date | string;
  readonly status: string;
  readonly effectiveStatus: string;
  readonly notes: string | null;
  readonly cancelReason: string | null;
  readonly cancelledAt: Date | string | null;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
}

export interface CarrierPaymentTransactionRecord {
  readonly id: string;
  readonly obligationId: string;
  readonly kind: 'advance' | 'payment' | 'reversal';
  readonly amount: string;
  readonly relatedTransactionId: string | null;
  readonly proofDocumentId: string | null;
  readonly proofDocumentTitle: string | null;
  readonly proofDocumentStatus: string | null;
  readonly occurredAt: Date | string;
  readonly notes: string | null;
  readonly createdByUserId: string;
  readonly createdAt: Date | string;
}

export interface CarrierPaymentEventRecord {
  readonly id: string;
  readonly obligationId: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly actorUserId: string;
  readonly createdAt: Date | string;
}
