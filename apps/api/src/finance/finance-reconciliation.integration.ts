import assert from 'node:assert/strict';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { FinancePaymentService } from './finance-payment.service.js';
import { FinanceReceivableService } from './finance-receivable.service.js';
import { FinanceReconciliationService } from './finance-reconciliation.service.js';

const TENANT_A = '76000000-0000-4000-8000-000000000001';
const TENANT_B = '76000000-0000-4000-8000-000000000002';
const USER_A = '76000000-0000-4000-8000-000000000101';
const USER_B = '76000000-0000-4000-8000-000000000102';
const REQUEST_A = '76000000-0000-4000-8000-000000000701';
const CONTRACT_A = '76000000-0000-4000-8000-000000000901';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();
  const contextA = new TenantContext();
  contextA.establish({
    subject: 'integration|finance-reconciliation-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });
  const contextB = new TenantContext();
  contextB.establish({
    subject: 'integration|finance-reconciliation-b',
    tenantId: TENANT_B,
    userId: USER_B,
  });

  const receivablesA = new FinanceReceivableService(contextA, database);
  const paymentsA = new FinancePaymentService(contextA, database);
  const reconciliationA = new FinanceReconciliationService(contextA, database);
  const reconciliationB = new FinanceReconciliationService(contextB, database);

  try {
    await database.withTenantContext(contextA.require(), async (client) => {
      await client.query(
        `INSERT INTO transport_contracts (
           id,tenant_id,transport_request_id,reservation_id,proposal_id,capacity_assignment_id,
           driver_id,vehicle_id,carrier_party_id,status,currency_code,freight_amount,toll_amount,
           additional_amount,payment_terms,commercial_notes,confirmed_by_user_id,confirmed_at
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,
           '76000000-0000-4000-8000-000000000841','76000000-0000-4000-8000-000000000831',
           '76000000-0000-4000-8000-000000000821','76000000-0000-4000-8000-000000000801',
           '76000000-0000-4000-8000-000000000811','76000000-0000-4000-8000-000000000501',
           'confirmed','BRL',15000,300,0,'50% coleta / 50% entrega','NEX-53 reconciliation fixture',
           $4::uuid,'2026-09-02T18:00:00Z'
         )`,
        [CONTRACT_A, TENANT_A, REQUEST_A, USER_A],
      );
    });

    const receivable = await receivablesA.createReceivable({
      transportRequestId: REQUEST_A,
      invoicedAmount: '19000.00',
      dueAt: '2026-09-20T12:00:00Z',
      fiscalReference: 'NF-NEX53-001',
      notes: 'NEX-53 customer receivable',
    });
    const obligation = await paymentsA.createObligation({
      transportContractId: CONTRACT_A,
      dueAt: '2026-09-21T12:00:00Z',
      notes: 'NEX-53 carrier payable',
    });
    assert.equal(receivable.balanceAmount, '19000.00');
    assert.equal(obligation.balanceAmount, '15300.00');

    const imported = await reconciliationA.createImport({
      source: 'bank_statement',
      provider: 'generic-csv',
      externalBatchId: 'NEX53-BATCH-001',
      accountReference: 'BANK-BRL-001',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      entries: [
        {
          externalId: 'credit-001',
          direction: 'credit',
          amount: '19000.00',
          currencyCode: 'BRL',
          occurredAt: '2026-09-20T11:00:00Z',
          reference: 'NF-NEX53-001',
          counterpartyName: 'NEX-50 Customer A',
          rawPayload: { sourceLine: 1 },
        },
        {
          externalId: 'debit-manual-001',
          direction: 'debit',
          amount: '5000.00',
          currencyCode: 'BRL',
          occurredAt: '2026-07-01T12:00:00Z',
          reference: 'UNMAPPED-BANK-REFERENCE',
          counterpartyName: 'Unknown beneficiary',
          rawPayload: { sourceLine: 2 },
        },
        {
          externalId: 'debit-suggested-001',
          direction: 'debit',
          amount: '10300.00',
          currencyCode: 'BRL',
          occurredAt: '2026-09-21T10:00:00Z',
          reference: CONTRACT_A,
          counterpartyName: 'NEX-50 Carrier A',
          rawPayload: { sourceLine: 3 },
        },
        {
          externalId: 'ignore-001',
          direction: 'credit',
          amount: '1.00',
          currencyCode: 'BRL',
          occurredAt: '2025-01-01T12:00:00Z',
          reference: 'BANK-FEE-CORRECTION',
          counterpartyName: 'Unknown',
          rawPayload: { sourceLine: 4 },
        },
      ],
    });
    assert.equal(imported.entryCount, 4);

    const queue = await reconciliationA.listQueue();
    assert.equal(queue.length, 4);
    const creditEntry = queue.find((entry) => entry.externalId === 'credit-001');
    const manualDebitEntry = queue.find((entry) => entry.externalId === 'debit-manual-001');
    const suggestedDebitEntry = queue.find((entry) => entry.externalId === 'debit-suggested-001');
    const ignoredEntry = queue.find((entry) => entry.externalId === 'ignore-001');
    assert.ok(creditEntry && manualDebitEntry && suggestedDebitEntry && ignoredEntry);

    const suggestedCredit = await reconciliationA.suggest(creditEntry.id);
    assert.equal(suggestedCredit.status, 'suggested');
    assert.equal(suggestedCredit.suggestedTargetType, 'customer_receivable');
    assert.equal(suggestedCredit.suggestedTargetId, receivable.id);
    assert.ok((suggestedCredit.suggestedScore ?? 0) >= 70);

    const divergentDebit = await reconciliationA.suggest(manualDebitEntry.id);
    assert.equal(divergentDebit.status, 'divergent');
    assert.equal(divergentDebit.suggestedTargetId, null);

    const manualMatch = await reconciliationA.reconcile(manualDebitEntry.id, {
      targetType: 'carrier_payment',
      targetId: obligation.id,
      matchMethod: 'manual',
      notes: 'Finance reviewed beneficiary and confirmed carrier obligation',
    });
    assert.equal(manualMatch.status, 'reconciled');
    assert.equal(manualMatch.matches[0]?.matchMethod, 'manual');
    const afterManualPayment = await paymentsA.getObligation(obligation.id);
    assert.equal(afterManualPayment.status, 'partially_paid');
    assert.equal(afterManualPayment.balanceAmount, '10300.00');

    const suggestedDebit = await reconciliationA.suggest(suggestedDebitEntry.id);
    assert.equal(suggestedDebit.status, 'suggested');
    assert.equal(suggestedDebit.suggestedTargetType, 'carrier_payment');
    assert.equal(suggestedDebit.suggestedTargetId, obligation.id);
    assert.ok((suggestedDebit.suggestedScore ?? 0) >= 70);

    const reconciledDebit = await reconciliationA.reconcile(suggestedDebitEntry.id, {
      targetType: 'carrier_payment',
      targetId: obligation.id,
      matchMethod: 'suggested',
    });
    assert.equal(reconciledDebit.status, 'reconciled');
    assert.equal((await paymentsA.getObligation(obligation.id)).status, 'paid');

    const reconciledCredit = await reconciliationA.reconcile(creditEntry.id, {
      targetType: 'customer_receivable',
      targetId: receivable.id,
      matchMethod: 'suggested',
    });
    assert.equal(reconciledCredit.status, 'reconciled');
    assert.equal((await receivablesA.getReceivable(receivable.id)).status, 'paid');

    const ignoredSuggestion = await reconciliationA.suggest(ignoredEntry.id);
    assert.equal(ignoredSuggestion.status, 'divergent');
    const ignored = await reconciliationA.ignore(ignoredEntry.id, {
      reason: 'Administrative bank correction outside operational ledgers',
    });
    assert.equal(ignored.status, 'ignored');
    await assert.rejects(() => reconciliationA.suggest(ignoredEntry.id), /terminal/);

    const manualMatchId = manualMatch.matches[0]?.id;
    assert.ok(manualMatchId);
    const reversed = await reconciliationA.reverse(manualMatchId, {
      reason: 'Bank beneficiary review showed the first manual link was wrong',
    });
    assert.equal(reversed.status, 'divergent');
    assert.equal(reversed.matches[0]?.status, 'reversed');
    assert.ok(reversed.matches[0]?.reversalTransactionId);
    assert.ok(reversed.events.some((event) => event.eventType === 'reconciliation_reversed'));

    const afterReversal = await paymentsA.getObligation(obligation.id);
    assert.equal(afterReversal.status, 'partially_paid');
    assert.equal(afterReversal.balanceAmount, '5000.00');

    await database.withTenantContext(contextA.require(), async (client) => {
      await assert.rejects(
        client.query('DELETE FROM financial_reconciliation_entries WHERE id=$1::uuid', [creditEntry.id]),
        (error: unknown) => ['42501', 'P0001'].includes((error as { code?: string }).code ?? ''),
      );
      await assert.rejects(
        client.query(
          `INSERT INTO financial_reconciliation_events(tenant_id,entry_id,event_type,payload,actor_user_id)
           VALUES ($1::uuid,$2::uuid,'matching_attempted','{}'::jsonb,$3::uuid)`,
          [TENANT_A, creditEntry.id, USER_A],
        ),
        (error: unknown) => (error as { code?: string }).code === '42501',
      );
    });

    assert.equal((await reconciliationB.listQueue()).length, 0);
    await assert.rejects(
      () => reconciliationB.getEntry(creditEntry.id),
      /reconciliation entry not found in current tenant/,
    );
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
