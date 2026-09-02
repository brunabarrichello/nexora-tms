import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import type {
  FinancialReconciliationCandidateRecord,
  FinancialReconciliationEntryDetail,
  FinancialReconciliationEntryRecord,
  FinancialReconciliationEventRecord,
  FinancialReconciliationImportRecord,
  FinancialReconciliationMatchRecord,
  FinancialReconciliationTargetType,
} from './finance-reconciliation.types.js';
import {
  parseCreateFinancialReconciliationImport,
  parseIgnoreFinancialReconciliation,
  parseReconcileFinancialEntry,
  parseReverseFinancialReconciliation,
  requireReconciliationUuid,
} from './finance-reconciliation.validation.js';

interface CandidateBase {
  readonly targetType: FinancialReconciliationTargetType;
  readonly targetId: string;
  readonly reference: string;
  readonly counterpartyName: string;
  readonly amount: string;
  readonly balanceAmount: string;
  readonly dueAt: string;
}

@Injectable()
export class FinanceReconciliationService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  listImports(): Promise<readonly FinancialReconciliationImportRecord[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<FinancialReconciliationImportRecord>(
        `SELECT i.id::text AS id,i.source,i.provider,i.external_batch_id AS "externalBatchId",
                i.account_reference AS "accountReference",i.period_start::text AS "periodStart",
                i.period_end::text AS "periodEnd",i.created_by_user_id::text AS "createdByUserId",
                i.created_at AS "createdAt",count(e.id)::int AS "entryCount"
           FROM financial_reconciliation_imports i
           LEFT JOIN financial_reconciliation_entries e
             ON e.tenant_id=i.tenant_id AND e.import_id=i.id
          GROUP BY i.id
          ORDER BY i.created_at DESC,i.id DESC`,
      );
      return result.rows;
    });
  }

  listQueue(): Promise<readonly FinancialReconciliationEntryRecord[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<FinancialReconciliationEntryRecord>(
        `${entryProjectionSql()}
          ORDER BY CASE e.status
                     WHEN 'divergent' THEN 0
                     WHEN 'suggested' THEN 1
                     WHEN 'pending' THEN 2
                     WHEN 'reconciled' THEN 3
                     ELSE 4
                   END,
                   e.occurred_at DESC,e.created_at DESC,e.id DESC`,
      );
      return result.rows;
    });
  }

  async getEntry(entryIdValue: string): Promise<FinancialReconciliationEntryDetail> {
    const entryId = requireReconciliationUuid(entryIdValue, 'entryId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const entry = await this.requireEntry(client, entryId);
      return this.buildEntryDetail(client, entry);
    });
  }

  async createImport(input: unknown): Promise<FinancialReconciliationImportRecord> {
    const payload = parseCreateFinancialReconciliationImport(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      try {
        const importResult = await client.query<{ id: string }>(
          `INSERT INTO financial_reconciliation_imports(
             tenant_id,source,provider,external_batch_id,account_reference,period_start,period_end,created_by_user_id
           ) VALUES ($1::uuid,$2,$3,$4,$5,$6::date,$7::date,$8::uuid)
           RETURNING id::text AS id`,
          [
            context.tenantId,
            payload.source,
            payload.provider,
            payload.externalBatchId,
            payload.accountReference,
            payload.periodStart,
            payload.periodEnd,
            context.userId,
          ],
        );
        const importId = importResult.rows[0]?.id;
        if (!importId) throw new ConflictException('reconciliation import could not be persisted');

        for (const entry of payload.entries) {
          const entryResult = await client.query<{ id: string }>(
            `INSERT INTO financial_reconciliation_entries(
               tenant_id,import_id,external_id,direction,amount,currency_code,occurred_at,
               reference,counterparty_name,status,raw_payload,created_by_user_id
             ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::numeric(14,2),$6,$7::timestamptz,$8,$9,'pending',$10::jsonb,$11::uuid)
             RETURNING id::text AS id`,
            [
              context.tenantId,
              importId,
              entry.externalId,
              entry.direction,
              entry.amount,
              entry.currencyCode,
              entry.occurredAt,
              entry.reference,
              entry.counterpartyName,
              JSON.stringify(entry.rawPayload),
              context.userId,
            ],
          );
          const entryId = entryResult.rows[0]?.id;
          if (!entryId) throw new ConflictException('reconciliation entry could not be persisted');
          await this.recordEvent(client, entryId, null, 'entry_imported', {
            importId,
            source: payload.source,
            externalId: entry.externalId,
            direction: entry.direction,
            amount: entry.amount,
            currencyCode: entry.currencyCode,
          });
        }

        return this.requireImport(client, importId);
      } catch (error) {
        throwReconciliationError(error);
      }
    });
  }

  async suggest(entryIdValue: string): Promise<FinancialReconciliationEntryDetail> {
    const entryId = requireReconciliationUuid(entryIdValue, 'entryId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      try {
        const entry = await this.requireEntry(client, entryId, true);
        if (entry.status === 'reconciled' || entry.status === 'ignored') {
          throw new ConflictException('terminal reconciliation entry cannot be rematched');
        }

        const candidates = await this.computeCandidates(client, entry);
        const top = candidates[0];
        const second = candidates[1];
        const unambiguous = Boolean(
          top && top.score >= 70 && (!second || top.score - second.score >= 10),
        );

        if (top && unambiguous) {
          await client.query(
            `UPDATE financial_reconciliation_entries
                SET status='suggested',suggested_target_type=$2,suggested_target_id=$3::uuid,
                    suggested_score=$4,suggestion_reason=$5
              WHERE id=$1::uuid`,
            [entryId, top.targetType, top.targetId, top.score, top.reasons.join('; ')],
          );
        } else {
          const reason = top
            ? `Ambiguous or weak match: top score ${top.score}${second ? `, second score ${second.score}` : ''}`
            : 'No eligible financial target found for amount, currency and direction';
          await client.query(
            `UPDATE financial_reconciliation_entries
                SET status='divergent',suggested_target_type=NULL,suggested_target_id=NULL,
                    suggested_score=NULL,suggestion_reason=$2
              WHERE id=$1::uuid`,
            [entryId, reason],
          );
        }

        await this.recordEvent(client, entryId, null, 'matching_attempted', {
          candidateCount: candidates.length,
          suggested:
            top && unambiguous
              ? { targetType: top.targetType, targetId: top.targetId, score: top.score }
              : null,
          candidates: candidates.slice(0, 5).map((candidate) => ({
            targetType: candidate.targetType,
            targetId: candidate.targetId,
            score: candidate.score,
          })),
        });

        const updated = await this.requireEntry(client, entryId);
        return this.buildEntryDetail(client, updated, candidates);
      } catch (error) {
        throwReconciliationError(error);
      }
    });
  }

  async reconcile(
    entryIdValue: string,
    input: unknown,
  ): Promise<FinancialReconciliationEntryDetail> {
    const entryId = requireReconciliationUuid(entryIdValue, 'entryId');
    const payload = parseReconcileFinancialEntry(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      try {
        const entry = await this.requireEntry(client, entryId, true);
        if (entry.status === 'reconciled' || entry.status === 'ignored') {
          throw new ConflictException('reconciliation entry is terminal');
        }
        const expectedType =
          entry.direction === 'credit' ? 'customer_receivable' : 'carrier_payment';
        if (payload.targetType !== expectedType) {
          throw new ConflictException('target type does not match reconciliation entry direction');
        }
        if (
          payload.matchMethod === 'suggested' &&
          (entry.status !== 'suggested' ||
            entry.suggestedTargetType !== payload.targetType ||
            entry.suggestedTargetId !== payload.targetId ||
            (entry.suggestedScore ?? 0) < 70)
        ) {
          throw new ConflictException(
            'suggested reconciliation must use the qualified current suggestion',
          );
        }

        const ledgerTransactionId = await this.insertLedgerTransaction(
          client,
          entry,
          payload.targetType,
          payload.targetId,
          payload.proofDocumentId,
          payload.notes,
        );
        const score =
          entry.suggestedTargetType === payload.targetType &&
          entry.suggestedTargetId === payload.targetId
            ? entry.suggestedScore
            : null;

        const matchResult = await client.query<{ id: string }>(
          `INSERT INTO financial_reconciliation_matches(
             tenant_id,entry_id,target_type,target_id,ledger_transaction_id,match_method,score,matched_by_user_id
           ) VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5::uuid,$6,$7,$8::uuid)
           RETURNING id::text AS id`,
          [
            context.tenantId,
            entryId,
            payload.targetType,
            payload.targetId,
            ledgerTransactionId,
            payload.matchMethod,
            score,
            context.userId,
          ],
        );
        const matchId = matchResult.rows[0]?.id;
        if (!matchId) throw new ConflictException('reconciliation match could not be persisted');

        await client.query(
          `UPDATE financial_reconciliation_entries
              SET status='reconciled'
            WHERE id=$1::uuid`,
          [entryId],
        );
        await this.recordEvent(client, entryId, matchId, 'reconciled', {
          targetType: payload.targetType,
          targetId: payload.targetId,
          ledgerTransactionId,
          matchMethod: payload.matchMethod,
          score,
        });

        const updated = await this.requireEntry(client, entryId);
        return this.buildEntryDetail(client, updated);
      } catch (error) {
        throwReconciliationError(error);
      }
    });
  }

  async ignore(entryIdValue: string, input: unknown): Promise<FinancialReconciliationEntryDetail> {
    const entryId = requireReconciliationUuid(entryIdValue, 'entryId');
    const payload = parseIgnoreFinancialReconciliation(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      try {
        const entry = await this.requireEntry(client, entryId, true);
        if (entry.status === 'reconciled' || entry.status === 'ignored') {
          throw new ConflictException('terminal reconciliation entry cannot be ignored');
        }
        await client.query(
          `UPDATE financial_reconciliation_entries
              SET status='ignored',suggested_target_type=NULL,suggested_target_id=NULL,
                  suggested_score=NULL,suggestion_reason=$2
            WHERE id=$1::uuid`,
          [entryId, `Ignored: ${payload.reason}`],
        );
        await this.recordEvent(client, entryId, null, 'entry_ignored', { reason: payload.reason });
        return this.buildEntryDetail(client, await this.requireEntry(client, entryId));
      } catch (error) {
        throwReconciliationError(error);
      }
    });
  }

  async reverse(matchIdValue: string, input: unknown): Promise<FinancialReconciliationEntryDetail> {
    const matchId = requireReconciliationUuid(matchIdValue, 'matchId');
    const payload = parseReverseFinancialReconciliation(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      try {
        const match = await this.requireActiveMatch(client, matchId, true);
        const entry = await this.requireEntry(client, match.entryId, true);
        const reversalTransactionId = await this.insertLedgerReversal(
          client,
          match,
          payload.reason,
        );

        await client.query(
          `UPDATE financial_reconciliation_matches
              SET status='reversed',reversal_transaction_id=$2::uuid,reversed_by_user_id=$3::uuid,
                  reversed_at=now(),reverse_reason=$4
            WHERE id=$1::uuid AND status='active'`,
          [matchId, reversalTransactionId, context.userId, payload.reason],
        );
        await client.query(
          `UPDATE financial_reconciliation_entries
              SET status='divergent',suggested_target_type=NULL,suggested_target_id=NULL,
                  suggested_score=NULL,suggestion_reason='Reconciliation reversed; manual review required'
            WHERE id=$1::uuid`,
          [entry.id],
        );
        await this.recordEvent(client, entry.id, matchId, 'reconciliation_reversed', {
          reversalTransactionId,
          reason: payload.reason,
        });
        return this.buildEntryDetail(client, await this.requireEntry(client, entry.id));
      } catch (error) {
        throwReconciliationError(error);
      }
    });
  }

  private async requireImport(
    client: TenantQueryClient,
    importId: string,
  ): Promise<FinancialReconciliationImportRecord> {
    const result = await client.query<FinancialReconciliationImportRecord>(
      `SELECT i.id::text AS id,i.source,i.provider,i.external_batch_id AS "externalBatchId",
              i.account_reference AS "accountReference",i.period_start::text AS "periodStart",
              i.period_end::text AS "periodEnd",i.created_by_user_id::text AS "createdByUserId",
              i.created_at AS "createdAt",count(e.id)::int AS "entryCount"
         FROM financial_reconciliation_imports i
         LEFT JOIN financial_reconciliation_entries e ON e.tenant_id=i.tenant_id AND e.import_id=i.id
        WHERE i.id=$1::uuid
        GROUP BY i.id`,
      [importId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('reconciliation import not found in current tenant');
    return row;
  }

  private async requireEntry(
    client: TenantQueryClient,
    entryId: string,
    forUpdate = false,
  ): Promise<FinancialReconciliationEntryRecord> {
    const result = await client.query<FinancialReconciliationEntryRecord>(
      `${entryProjectionSql()} WHERE e.id=$1::uuid${forUpdate ? ' FOR UPDATE' : ''}`,
      [entryId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('reconciliation entry not found in current tenant');
    return row;
  }

  private async requireActiveMatch(
    client: TenantQueryClient,
    matchId: string,
    forUpdate = false,
  ): Promise<FinancialReconciliationMatchRecord> {
    const result = await client.query<FinancialReconciliationMatchRecord>(
      `${matchProjectionSql()} WHERE m.id=$1::uuid AND m.status='active'${forUpdate ? ' FOR UPDATE' : ''}`,
      [matchId],
    );
    const row = result.rows[0];
    if (!row)
      throw new NotFoundException('active reconciliation match not found in current tenant');
    return row;
  }

  private async buildEntryDetail(
    client: TenantQueryClient,
    entry: FinancialReconciliationEntryRecord,
    candidates?: readonly FinancialReconciliationCandidateRecord[],
  ): Promise<FinancialReconciliationEntryDetail> {
    const resolvedCandidates = candidates ?? (await this.computeCandidates(client, entry));
    const matches = await client.query<FinancialReconciliationMatchRecord>(
      `${matchProjectionSql()} WHERE m.entry_id=$1::uuid ORDER BY m.matched_at DESC,m.id DESC`,
      [entry.id],
    );
    const events = await client.query<FinancialReconciliationEventRecord>(
      `SELECT ev.id::text AS id,ev.entry_id::text AS "entryId",ev.match_id::text AS "matchId",
              ev.event_type AS "eventType",ev.payload,ev.actor_user_id::text AS "actorUserId",
              ev.created_at AS "createdAt"
         FROM financial_reconciliation_events ev
        WHERE ev.entry_id=$1::uuid
        ORDER BY ev.created_at,ev.id`,
      [entry.id],
    );
    return {
      ...entry,
      candidates: resolvedCandidates,
      matches: matches.rows,
      events: events.rows,
    };
  }

  private async computeCandidates(
    client: TenantQueryClient,
    entry: FinancialReconciliationEntryRecord,
  ): Promise<readonly FinancialReconciliationCandidateRecord[]> {
    const bases =
      entry.direction === 'credit'
        ? await this.loadReceivableCandidates(client, entry)
        : await this.loadCarrierPaymentCandidates(client, entry);
    return bases
      .map((base) => scoreCandidate(entry, base))
      .sort((left, right) => right.score - left.score || left.dueAt.localeCompare(right.dueAt))
      .slice(0, 10);
  }

  private async loadReceivableCandidates(
    client: TenantQueryClient,
    entry: FinancialReconciliationEntryRecord,
  ): Promise<readonly CandidateBase[]> {
    const result = await client.query<CandidateBase>(
      `SELECT 'customer_receivable'::text AS "targetType",r.id::text AS "targetId",
              coalesce(r.fiscal_reference,r.transport_request_id::text) AS reference,
              p.legal_name AS "counterpartyName",r.invoiced_amount::text AS amount,
              (r.invoiced_amount-coalesce(tx.received,0))::numeric(14,2)::text AS "balanceAmount",
              r.due_at AS "dueAt"
         FROM customer_receivables r
         JOIN business_parties p ON p.tenant_id=r.tenant_id AND p.id=r.customer_party_id
         LEFT JOIN LATERAL (
           SELECT coalesce(sum(CASE WHEN t.kind='receipt' THEN t.amount ELSE -t.amount END),0)::numeric(14,2) AS received
             FROM customer_receivable_transactions t
            WHERE t.tenant_id=r.tenant_id AND t.receivable_id=r.id
         ) tx ON true
        WHERE r.status <> 'cancelled'
          AND r.currency_code=$1
          AND (r.invoiced_amount-coalesce(tx.received,0)) >= $2::numeric(14,2)
        ORDER BY r.due_at,r.id
        LIMIT 50`,
      [entry.currencyCode, entry.amount],
    );
    return result.rows;
  }

  private async loadCarrierPaymentCandidates(
    client: TenantQueryClient,
    entry: FinancialReconciliationEntryRecord,
  ): Promise<readonly CandidateBase[]> {
    const result = await client.query<CandidateBase>(
      `SELECT 'carrier_payment'::text AS "targetType",o.id::text AS "targetId",
              o.transport_contract_id::text AS reference,p.legal_name AS "counterpartyName",
              o.contracted_amount::text AS amount,
              (o.contracted_amount-coalesce(tx.settled,0))::numeric(14,2)::text AS "balanceAmount",
              o.due_at AS "dueAt"
         FROM carrier_payment_obligations o
         JOIN business_parties p ON p.tenant_id=o.tenant_id AND p.id=o.carrier_party_id
         LEFT JOIN LATERAL (
           SELECT coalesce(sum(CASE WHEN t.kind IN ('advance','payment') THEN t.amount ELSE -t.amount END),0)::numeric(14,2) AS settled
             FROM carrier_payment_transactions t
            WHERE t.tenant_id=o.tenant_id AND t.obligation_id=o.id
         ) tx ON true
        WHERE o.status <> 'cancelled'
          AND o.currency_code=$1
          AND (o.contracted_amount-coalesce(tx.settled,0)) >= $2::numeric(14,2)
        ORDER BY o.due_at,o.id
        LIMIT 50`,
      [entry.currencyCode, entry.amount],
    );
    return result.rows;
  }

  private async insertLedgerTransaction(
    client: TenantQueryClient,
    entry: FinancialReconciliationEntryRecord,
    targetType: FinancialReconciliationTargetType,
    targetId: string,
    proofDocumentId: string | null,
    notes: string | null,
  ): Promise<string> {
    const context = this.tenantContext.require();
    const reconciliationNote = notes
      ? `Reconciliation ${entry.id}: ${notes}`
      : `Reconciliation ${entry.id}`;
    const result =
      targetType === 'customer_receivable'
        ? await client.query<{ id: string }>(
            `INSERT INTO customer_receivable_transactions(
               tenant_id,receivable_id,kind,amount,proof_document_id,occurred_at,notes,created_by_user_id
             ) VALUES ($1::uuid,$2::uuid,'receipt',$3::numeric(14,2),$4::uuid,$5::timestamptz,$6,$7::uuid)
             RETURNING id::text AS id`,
            [
              context.tenantId,
              targetId,
              entry.amount,
              proofDocumentId,
              entry.occurredAt,
              reconciliationNote,
              context.userId,
            ],
          )
        : await client.query<{ id: string }>(
            `INSERT INTO carrier_payment_transactions(
               tenant_id,obligation_id,kind,amount,proof_document_id,occurred_at,notes,created_by_user_id
             ) VALUES ($1::uuid,$2::uuid,'payment',$3::numeric(14,2),$4::uuid,$5::timestamptz,$6,$7::uuid)
             RETURNING id::text AS id`,
            [
              context.tenantId,
              targetId,
              entry.amount,
              proofDocumentId,
              entry.occurredAt,
              reconciliationNote,
              context.userId,
            ],
          );
    const id = result.rows[0]?.id;
    if (!id) throw new ConflictException('financial ledger transaction could not be persisted');
    return id;
  }

  private async insertLedgerReversal(
    client: TenantQueryClient,
    match: FinancialReconciliationMatchRecord,
    reason: string,
  ): Promise<string> {
    const context = this.tenantContext.require();
    const result =
      match.targetType === 'customer_receivable'
        ? await client.query<{ id: string }>(
            `INSERT INTO customer_receivable_transactions(
               tenant_id,receivable_id,kind,amount,related_transaction_id,occurred_at,notes,created_by_user_id
             )
             SELECT $1::uuid,t.receivable_id,'reversal',t.amount,t.id,now(),$3,$4::uuid
               FROM customer_receivable_transactions t
              WHERE t.id=$2::uuid AND t.kind='receipt'
             RETURNING id::text AS id`,
            [
              context.tenantId,
              match.ledgerTransactionId,
              `Reconciliation reversal: ${reason}`,
              context.userId,
            ],
          )
        : await client.query<{ id: string }>(
            `INSERT INTO carrier_payment_transactions(
               tenant_id,obligation_id,kind,amount,related_transaction_id,occurred_at,notes,created_by_user_id
             )
             SELECT $1::uuid,t.obligation_id,'reversal',t.amount,t.id,now(),$3,$4::uuid
               FROM carrier_payment_transactions t
              WHERE t.id=$2::uuid AND t.kind IN ('advance','payment')
             RETURNING id::text AS id`,
            [
              context.tenantId,
              match.ledgerTransactionId,
              `Reconciliation reversal: ${reason}`,
              context.userId,
            ],
          );
    const id = result.rows[0]?.id;
    if (!id)
      throw new ConflictException(
        'reconciliation reversal ledger transaction could not be persisted',
      );
    return id;
  }

  private async recordEvent(
    client: TenantQueryClient,
    entryId: string | null,
    matchId: string | null,
    eventType: FinancialReconciliationEventRecord['eventType'],
    payload: Record<string, unknown>,
  ): Promise<void> {
    const context = this.tenantContext.require();
    await client.query(
      `SELECT nexora_record_finance_reconciliation_event($1::uuid,$2::uuid,$3,$4::jsonb,$5::uuid)`,
      [entryId, matchId, eventType, JSON.stringify(payload), context.userId],
    );
  }
}

function entryProjectionSql(): string {
  return `SELECT e.id::text AS id,e.import_id::text AS "importId",e.external_id AS "externalId",
                 e.direction,e.amount::text AS amount,e.currency_code AS "currencyCode",e.occurred_at AS "occurredAt",
                 e.reference,e.counterparty_name AS "counterpartyName",e.status,
                 e.suggested_target_type AS "suggestedTargetType",e.suggested_target_id::text AS "suggestedTargetId",
                 e.suggested_score AS "suggestedScore",e.suggestion_reason AS "suggestionReason",
                 e.created_at AS "createdAt",e.updated_at AS "updatedAt"
            FROM financial_reconciliation_entries e`;
}

function matchProjectionSql(): string {
  return `SELECT m.id::text AS id,m.entry_id::text AS "entryId",m.target_type AS "targetType",
                 m.target_id::text AS "targetId",m.ledger_transaction_id::text AS "ledgerTransactionId",
                 m.match_method AS "matchMethod",m.score,m.status,
                 m.reversal_transaction_id::text AS "reversalTransactionId",
                 m.matched_by_user_id::text AS "matchedByUserId",m.matched_at AS "matchedAt",
                 m.reversed_by_user_id::text AS "reversedByUserId",m.reversed_at AS "reversedAt",
                 m.reverse_reason AS "reverseReason"
            FROM financial_reconciliation_matches m`;
}

function scoreCandidate(
  entry: FinancialReconciliationEntryRecord,
  candidate: CandidateBase,
): FinancialReconciliationCandidateRecord {
  let score = 0;
  const reasons: string[] = [];
  if (Number(candidate.balanceAmount) === Number(entry.amount)) {
    score += 45;
    reasons.push('exact remaining amount');
  } else {
    score += 30;
    reasons.push('amount fits remaining balance');
  }

  const entryReference = normalize(entry.reference);
  const candidateReference = normalize(candidate.reference);
  const candidateId = normalize(candidate.targetId);
  if (entryReference && candidateReference && entryReference === candidateReference) {
    score += 35;
    reasons.push('exact reference');
  } else if (
    entryReference &&
    ((candidateReference && entryReference.includes(candidateReference)) ||
      entryReference.includes(candidateId))
  ) {
    score += 25;
    reasons.push('reference contains target identifier');
  }

  const dayDistance = Math.abs(
    (new Date(entry.occurredAt).getTime() - new Date(candidate.dueAt).getTime()) / 86_400_000,
  );
  if (dayDistance <= 3) {
    score += 20;
    reasons.push('date within 3 days');
  } else if (dayDistance <= 7) {
    score += 15;
    reasons.push('date within 7 days');
  } else if (dayDistance <= 30) {
    score += 5;
    reasons.push('date within 30 days');
  }

  const entryCounterparty = normalize(entry.counterpartyName);
  const candidateCounterparty = normalize(candidate.counterpartyName);
  if (
    entryCounterparty &&
    candidateCounterparty &&
    (entryCounterparty.includes(candidateCounterparty) ||
      candidateCounterparty.includes(entryCounterparty))
  ) {
    score += 10;
    reasons.push('counterparty name match');
  }

  return { ...candidate, score: Math.min(score, 100), reasons };
}

function normalize(value: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function throwReconciliationError(error: unknown): never {
  if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
  const candidate = error as { code?: string; message?: string };
  if (candidate?.code === '23505')
    throw new ConflictException('reconciliation record already exists');
  if (['P0001', '23503', '23514', '42501'].includes(candidate?.code ?? '')) {
    throw new ConflictException(candidate.message ?? 'reconciliation rule rejected the operation');
  }
  throw error;
}
