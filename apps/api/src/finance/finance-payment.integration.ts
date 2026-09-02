import assert from 'node:assert/strict';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { FinancePaymentService } from './finance-payment.service.js';

const TENANT_A = '76000000-0000-4000-8000-000000000001';
const TENANT_B = '76000000-0000-4000-8000-000000000002';
const USER_A = '76000000-0000-4000-8000-000000000101';
const USER_B = '76000000-0000-4000-8000-000000000102';
const REQUEST_A = '76000000-0000-4000-8000-000000000701';
const CONTRACT_A = '76000000-0000-4000-8000-000000000901';
const TRIP_A = '76000000-0000-4000-8000-000000000931';
const PROOF_A = '76000000-0000-4000-8000-000000000921';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();

  const contextA = new TenantContext();
  contextA.establish({
    subject: 'integration|finance-payments-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });
  const paymentsA = new FinancePaymentService(contextA, database);

  const contextB = new TenantContext();
  contextB.establish({
    subject: 'integration|finance-payments-b',
    tenantId: TENANT_B,
    userId: USER_B,
  });
  const paymentsB = new FinancePaymentService(contextB, database);

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
           'confirmed','BRL',15000,300,0,'50% coleta / 50% entrega','NEX-51 payment fixture',
           $4::uuid,'2026-09-02T18:00:00Z'
         )`,
        [CONTRACT_A, TENANT_A, REQUEST_A, USER_A],
      );

      await client.query(
        `INSERT INTO trips (
           id,tenant_id,code,status,planned_start_at,planned_end_at,notes,created_by_user_id,updated_by_user_id
         ) VALUES ($1::uuid,$2::uuid,'NEX51-TRIP-001','planned','2026-09-10T07:00:00Z',
                   '2026-09-11T20:00:00Z','NEX-51 payment-linked trip',$3::uuid,$3::uuid)`,
        [TRIP_A, TENANT_A, USER_A],
      );
      await client.query(
        `INSERT INTO trip_transport_requests (
           tenant_id,trip_id,transport_request_id,transport_contract_id,sequence
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,1)`,
        [TENANT_A, TRIP_A, REQUEST_A, CONTRACT_A],
      );
    });

    const obligation = await paymentsA.createObligation({
      transportContractId: CONTRACT_A,
      tripId: TRIP_A,
      dueAt: '2026-09-20T12:00:00Z',
      notes: 'NEX-51 carrier obligation',
    });
    assert.equal(obligation.transportContractId, CONTRACT_A);
    assert.equal(obligation.transportRequestId, REQUEST_A);
    assert.equal(obligation.tripId, TRIP_A);
    assert.equal(obligation.tripCode, 'NEX51-TRIP-001');
    assert.equal(obligation.contractedAmount, '15300.00');
    assert.equal(obligation.settledAmount, '0.00');
    assert.equal(obligation.balanceAmount, '15300.00');
    assert.equal(obligation.status, 'open');
    assert.equal(obligation.effectiveStatus, 'open');

    const advance = await paymentsA.createTransaction(obligation.id, {
      kind: 'advance',
      amount: '3000.00',
      proofDocumentId: PROOF_A,
      occurredAt: '2026-09-03T12:00:00Z',
      notes: '20% advance with proof',
    });
    assert.equal(advance.kind, 'advance');
    assert.equal(advance.amount, '3000.00');
    assert.equal(advance.proofDocumentId, PROOF_A);
    assert.equal(advance.proofDocumentTitle, 'Comprovante de adiantamento NEX-51');

    const partiallyPaid = await paymentsA.getObligation(obligation.id);
    assert.equal(partiallyPaid.status, 'partially_paid');
    assert.equal(partiallyPaid.advanceAmount, '3000.00');
    assert.equal(partiallyPaid.settledAmount, '3000.00');
    assert.equal(partiallyPaid.balanceAmount, '12300.00');

    await assert.rejects(
      paymentsA.createTransaction(obligation.id, {
        kind: 'payment',
        amount: '12300.01',
        notes: 'must exceed remaining balance',
      }),
      /exceeds obligation balance/,
    );

    const settlement = await paymentsA.createTransaction(obligation.id, {
      kind: 'payment',
      amount: '12300.00',
      occurredAt: '2026-09-11T18:00:00Z',
      notes: 'final carrier balance',
    });
    assert.equal(settlement.kind, 'payment');

    const paid = await paymentsA.getObligation(obligation.id);
    assert.equal(paid.status, 'paid');
    assert.equal(paid.paymentAmount, '12300.00');
    assert.equal(paid.settledAmount, '15300.00');
    assert.equal(paid.balanceAmount, '0.00');

    await assert.rejects(
      paymentsA.cancelObligation(obligation.id, {
        reason: 'Should require reversals before cancellation',
      }),
      /must reverse transactions before cancellation/,
    );

    await database.withTenantContext(contextA.require(), async (client) => {
      await assert.rejects(
        client.query('UPDATE carrier_payment_transactions SET notes=$1 WHERE id=$2::uuid', [
          'mutated',
          advance.id,
        ]),
        (error: unknown) => ['42501', 'P0001'].includes((error as { code?: string }).code ?? ''),
      );
    });

    await assert.rejects(
      paymentsA.createTransaction(obligation.id, {
        kind: 'reversal',
        amount: settlement.amount,
        relatedTransactionId: settlement.id,
        occurredAt: '2026-09-10T12:00:00Z',
        notes: 'chronologically invalid reversal',
      }),
      /cannot occur before original transaction/,
    );

    const settlementReversal = await paymentsA.createTransaction(obligation.id, {
      kind: 'reversal',
      amount: settlement.amount,
      relatedTransactionId: settlement.id,
      occurredAt: '2026-09-12T12:00:00Z',
      notes: 'reverse final settlement for correction',
    });
    assert.equal(settlementReversal.relatedTransactionId, settlement.id);

    const afterSettlementReversal = await paymentsA.getObligation(obligation.id);
    assert.equal(afterSettlementReversal.status, 'partially_paid');
    assert.equal(afterSettlementReversal.settledAmount, '3000.00');
    assert.equal(afterSettlementReversal.balanceAmount, '12300.00');

    await assert.rejects(
      paymentsA.createTransaction(obligation.id, {
        kind: 'reversal',
        amount: settlement.amount,
        relatedTransactionId: settlement.id,
        occurredAt: '2026-09-12T13:00:00Z',
      }),
      /already been reversed|record already exists/,
    );

    await paymentsA.createTransaction(obligation.id, {
      kind: 'reversal',
      amount: advance.amount,
      relatedTransactionId: advance.id,
      occurredAt: '2026-09-13T12:00:00Z',
      notes: 'reverse advance',
    });

    const reopened = await paymentsA.getObligation(obligation.id);
    assert.equal(reopened.status, 'open');
    assert.equal(reopened.settledAmount, '0.00');
    assert.equal(reopened.balanceAmount, '15300.00');

    const overdue = await paymentsA.updateObligation(obligation.id, {
      dueAt: '2026-09-01T12:00:00Z',
      notes: 'past due for effective overdue qualification',
    });
    assert.equal(overdue.status, 'open');
    assert.equal(overdue.effectiveStatus, 'overdue');

    const cancelled = await paymentsA.cancelObligation(obligation.id, {
      reason: 'Operation administratively cancelled after full reversals',
    });
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.effectiveStatus, 'cancelled');

    await assert.rejects(
      paymentsA.createTransaction(obligation.id, { kind: 'payment', amount: '1.00' }),
      /cancelled carrier payment obligation/,
    );

    const transactions = await paymentsA.listTransactions(obligation.id);
    assert.equal(transactions.length, 4);
    assert.deepEqual(
      transactions.map((item) => item.kind),
      ['advance', 'payment', 'reversal', 'reversal'],
    );

    const events = await paymentsA.listEvents(obligation.id);
    assert.ok(events.some((event) => event.eventType === 'created'));
    assert.ok(events.some((event) => event.eventType === 'due_at_changed'));
    assert.ok(events.some((event) => event.eventType === 'cancelled'));
    assert.equal(events.filter((event) => event.eventType === 'transaction_recorded').length, 4);

    await database.withTenantContext(contextA.require(), async (client) => {
      const eventId = events[0]?.id;
      assert.ok(eventId);
      await assert.rejects(
        client.query('DELETE FROM carrier_payment_events WHERE id=$1::uuid', [eventId]),
        (error: unknown) => ['42501', 'P0001'].includes((error as { code?: string }).code ?? ''),
      );
    });

    assert.equal((await paymentsB.listObligations()).length, 0);
    await assert.rejects(
      paymentsB.getObligation(obligation.id),
      /carrier payment obligation not found in current tenant/,
    );
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
