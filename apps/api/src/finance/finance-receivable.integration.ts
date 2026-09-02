import assert from 'node:assert/strict';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { FinanceReceivableService } from './finance-receivable.service.js';

const TENANT_A = '76000000-0000-4000-8000-000000000001';
const TENANT_B = '76000000-0000-4000-8000-000000000002';
const USER_A = '76000000-0000-4000-8000-000000000101';
const USER_B = '76000000-0000-4000-8000-000000000102';
const REQUEST_A = '76000000-0000-4000-8000-000000000701';
const FISCAL_A = '76000000-0000-4000-8000-000000000961';
const PROOF_A = '76000000-0000-4000-8000-000000000962';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();

  const contextA = new TenantContext();
  contextA.establish({
    subject: 'integration|finance-receivable-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });
  const receivablesA = new FinanceReceivableService(contextA, database);

  const contextB = new TenantContext();
  contextB.establish({
    subject: 'integration|finance-receivable-b',
    tenantId: TENANT_B,
    userId: USER_B,
  });
  const receivablesB = new FinanceReceivableService(contextB, database);

  try {
    const receivable = await receivablesA.createReceivable({
      transportRequestId: REQUEST_A,
      invoicedAmount: '19000.00',
      dueAt: '2026-09-20T12:00:00Z',
      fiscalDocumentId: FISCAL_A,
      fiscalReference: 'NFE-352609-NEX52-001',
      notes: 'NEX-52 customer invoice',
    });
    assert.equal(receivable.transportRequestId, REQUEST_A);
    assert.equal(receivable.customerName, 'NEX-50 Customer A');
    assert.equal(receivable.currencyCode, 'BRL');
    assert.equal(receivable.invoicedAmount, '19000.00');
    assert.equal(receivable.receivedAmount, '0.00');
    assert.equal(receivable.balanceAmount, '19000.00');
    assert.equal(receivable.fiscalDocumentId, FISCAL_A);
    assert.equal(receivable.fiscalDocumentTitle, 'NF-e faturamento NEX-52');
    assert.equal(receivable.status, 'open');

    const receipt = await receivablesA.createTransaction(receivable.id, {
      kind: 'receipt',
      amount: '5000.00',
      proofDocumentId: PROOF_A,
      occurredAt: '2026-09-10T12:00:00Z',
      notes: 'manual partial receipt',
    });
    assert.equal(receipt.kind, 'receipt');
    assert.equal(receipt.proofDocumentId, PROOF_A);
    assert.equal(receipt.proofDocumentTitle, 'Comprovante de recebimento NEX-52');

    const partial = await receivablesA.getReceivable(receivable.id);
    assert.equal(partial.status, 'partially_received');
    assert.equal(partial.receivedAmount, '5000.00');
    assert.equal(partial.balanceAmount, '14000.00');

    await assert.rejects(
      receivablesA.createTransaction(receivable.id, {
        kind: 'receipt',
        amount: '14000.01',
      }),
      /exceeds receivable balance/,
    );

    const finalReceipt = await receivablesA.createTransaction(receivable.id, {
      kind: 'receipt',
      amount: '14000.00',
      occurredAt: '2026-09-12T18:00:00Z',
      notes: 'manual final receipt',
    });

    const paid = await receivablesA.getReceivable(receivable.id);
    assert.equal(paid.status, 'paid');
    assert.equal(paid.receivedAmount, '19000.00');
    assert.equal(paid.balanceAmount, '0.00');

    await assert.rejects(
      receivablesA.cancelReceivable(receivable.id, {
        reason: 'Must reverse receipts before cancellation',
      }),
      /must reverse receipts before cancellation/,
    );

    await assert.rejects(
      receivablesA.createTransaction(receivable.id, {
        kind: 'reversal',
        amount: finalReceipt.amount,
        relatedTransactionId: finalReceipt.id,
        occurredAt: '2026-09-11T18:00:00Z',
      }),
      /cannot occur before original receipt/,
    );

    await database.withTenantContext(contextA.require(), async (client) => {
      await assert.rejects(
        client.query('UPDATE customer_receivable_transactions SET notes=$1 WHERE id=$2::uuid', [
          'mutated',
          receipt.id,
        ]),
        (error: unknown) => ['42501', 'P0001'].includes((error as { code?: string }).code ?? ''),
      );
    });

    const finalReversal = await receivablesA.createTransaction(receivable.id, {
      kind: 'reversal',
      amount: finalReceipt.amount,
      relatedTransactionId: finalReceipt.id,
      occurredAt: '2026-09-13T12:00:00Z',
      notes: 'reverse final receipt',
    });
    assert.equal(finalReversal.relatedTransactionId, finalReceipt.id);

    const reopenedPartial = await receivablesA.getReceivable(receivable.id);
    assert.equal(reopenedPartial.status, 'partially_received');
    assert.equal(reopenedPartial.receivedAmount, '5000.00');
    assert.equal(reopenedPartial.balanceAmount, '14000.00');

    await assert.rejects(
      receivablesA.createTransaction(receivable.id, {
        kind: 'reversal',
        amount: finalReceipt.amount,
        relatedTransactionId: finalReceipt.id,
        occurredAt: '2026-09-14T12:00:00Z',
      }),
      /already been reversed|record already exists/,
    );

    await receivablesA.createTransaction(receivable.id, {
      kind: 'reversal',
      amount: receipt.amount,
      relatedTransactionId: receipt.id,
      occurredAt: '2026-09-14T12:00:00Z',
      notes: 'reverse partial receipt',
    });

    const reopened = await receivablesA.getReceivable(receivable.id);
    assert.equal(reopened.status, 'open');
    assert.equal(reopened.receivedAmount, '0.00');
    assert.equal(reopened.balanceAmount, '19000.00');

    const overdue = await receivablesA.updateReceivable(receivable.id, {
      dueAt: '2026-09-01T12:00:00Z',
      fiscalReference: 'NFE-352609-NEX52-001-UPDATED',
      notes: 'past due for NEX-52 qualification',
    });
    assert.equal(overdue.status, 'open');
    assert.equal(overdue.effectiveStatus, 'overdue');

    const cancelled = await receivablesA.cancelReceivable(receivable.id, {
      reason: 'Customer invoice cancelled after complete receipt reversals',
    });
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.effectiveStatus, 'cancelled');

    await assert.rejects(
      receivablesA.createTransaction(receivable.id, { kind: 'receipt', amount: '1.00' }),
      /cancelled customer receivable/,
    );

    const transactions = await receivablesA.listTransactions(receivable.id);
    assert.equal(transactions.length, 4);
    assert.deepEqual(
      transactions.map((item) => item.kind),
      ['receipt', 'receipt', 'reversal', 'reversal'],
    );

    const events = await receivablesA.listEvents(receivable.id);
    assert.ok(events.some((event) => event.eventType === 'created'));
    assert.ok(events.some((event) => event.eventType === 'due_at_changed'));
    assert.ok(events.some((event) => event.eventType === 'fiscal_changed'));
    assert.ok(events.some((event) => event.eventType === 'cancelled'));
    assert.equal(events.filter((event) => event.eventType === 'transaction_recorded').length, 4);

    await database.withTenantContext(contextA.require(), async (client) => {
      const eventId = events[0]?.id;
      assert.ok(eventId);
      await assert.rejects(
        client.query('DELETE FROM customer_receivable_events WHERE id=$1::uuid', [eventId]),
        (error: unknown) => ['42501', 'P0001'].includes((error as { code?: string }).code ?? ''),
      );
    });

    assert.equal((await receivablesB.listReceivables()).length, 0);
    await assert.rejects(
      receivablesB.getReceivable(receivable.id),
      /customer receivable not found in current tenant/,
    );
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
