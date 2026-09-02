export type FinancialReconciliationDirection = 'credit' | 'debit';
export type FinancialReconciliationStatus =
  'pending' | 'suggested' | 'divergent' | 'reconciled' | 'ignored';
export type FinancialReconciliationTargetType = 'customer_receivable' | 'carrier_payment';
export type FinancialReconciliationMatchMethod = 'suggested' | 'manual';

export interface FinancialReconciliationImportRecord {
  readonly id: string;
  readonly source: string;
  readonly provider: string | null;
  readonly externalBatchId: string | null;
  readonly accountReference: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly createdByUserId: string;
  readonly createdAt: string;
  readonly entryCount: number;
}

export interface FinancialReconciliationEntryRecord {
  readonly id: string;
  readonly importId: string;
  readonly externalId: string | null;
  readonly direction: FinancialReconciliationDirection;
  readonly amount: string;
  readonly currencyCode: string;
  readonly occurredAt: string;
  readonly reference: string | null;
  readonly counterpartyName: string | null;
  readonly status: FinancialReconciliationStatus;
  readonly suggestedTargetType: FinancialReconciliationTargetType | null;
  readonly suggestedTargetId: string | null;
  readonly suggestedScore: number | null;
  readonly suggestionReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FinancialReconciliationCandidateRecord {
  readonly targetType: FinancialReconciliationTargetType;
  readonly targetId: string;
  readonly reference: string;
  readonly counterpartyName: string;
  readonly amount: string;
  readonly balanceAmount: string;
  readonly dueAt: string;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface FinancialReconciliationMatchRecord {
  readonly id: string;
  readonly entryId: string;
  readonly targetType: FinancialReconciliationTargetType;
  readonly targetId: string;
  readonly ledgerTransactionId: string;
  readonly matchMethod: FinancialReconciliationMatchMethod;
  readonly score: number | null;
  readonly status: 'active' | 'reversed';
  readonly reversalTransactionId: string | null;
  readonly matchedByUserId: string;
  readonly matchedAt: string;
  readonly reversedByUserId: string | null;
  readonly reversedAt: string | null;
  readonly reverseReason: string | null;
}

export interface FinancialReconciliationEventRecord {
  readonly id: string;
  readonly entryId: string | null;
  readonly matchId: string | null;
  readonly eventType:
    | 'entry_imported'
    | 'matching_attempted'
    | 'entry_ignored'
    | 'reconciled'
    | 'reconciliation_reversed';
  readonly payload: Record<string, unknown>;
  readonly actorUserId: string;
  readonly createdAt: string;
}

export interface FinancialReconciliationEntryDetail extends FinancialReconciliationEntryRecord {
  readonly candidates: readonly FinancialReconciliationCandidateRecord[];
  readonly matches: readonly FinancialReconciliationMatchRecord[];
  readonly events: readonly FinancialReconciliationEventRecord[];
}
