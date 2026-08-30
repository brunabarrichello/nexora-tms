import assert from 'node:assert/strict';

import { CapacityMatchingService } from '../matching/capacity-matching.service.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { CapacityReservationService } from './capacity-reservation.service.js';
import { FreightProposalService } from './freight-proposal.service.js';
import { TransportContractService } from './transport-contract.service.js';

const USER_A = '51000000-0000-4000-8000-000000000101';
const TENANT_A = '51000000-0000-4000-8000-000000000001';
const REQUEST_A = '52000000-0000-4000-8000-000000000801';
const ASSIGNMENT_A = '52000000-0000-4000-8000-000000000921';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();
  const tenantContext = new TenantContext();
  tenantContext.establish({
    subject: 'integration|contract-user-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });

  const matching = new CapacityMatchingService(tenantContext, database);
  const proposals = new FreightProposalService(tenantContext, database, matching);
  const reservations = new CapacityReservationService(tenantContext, database, matching);
  const contracts = new TransportContractService(tenantContext, database);

  try {
    const proposalHistory = await proposals.list(REQUEST_A);
    const accepted = proposalHistory.find((proposal) => proposal.status === 'accepted');
    assert.ok(accepted, 'NEX-38 integration must leave one accepted proposal');
    assert.equal(accepted.capacityAssignmentId, ASSIGNMENT_A);

    const reservationHistory = await reservations.list(REQUEST_A);
    const initiallyActive = reservationHistory.find(
      (reservation) => reservation.status === 'active',
    );
    assert.ok(initiallyActive, 'NEX-39 integration must leave one active reservation');

    const refused = await contracts.refuse(initiallyActive.id, {
      reason: 'Carrier declined the final operational confirmation',
    });
    assert.equal(refused.status, 'refused');
    assert.equal(refused.transportRequestId, REQUEST_A);
    assert.equal(refused.proposalId, accepted.id);
    assert.equal(refused.reservationId, initiallyActive.id);
    assert.equal(refused.refusalReason, 'Carrier declined the final operational confirmation');
    assert.equal(refused.refusedByUserId, USER_A);
    assert.ok(refused.refusedAt);
    assert.deepEqual(
      refused.events.map((event) => event.type),
      ['refused'],
    );

    const refusedReservation = (await reservations.list(REQUEST_A)).find(
      (reservation) => reservation.id === initiallyActive.id,
    );
    assert.equal(refusedReservation?.status, 'cancelled');
    assert.match(refusedReservation?.cancelReason ?? '', /Contract refused/);

    const contractReservation = await reservations.approve(accepted.id);
    const confirmed = await contracts.confirm(contractReservation.id);
    assert.equal(confirmed.status, 'confirmed');
    assert.equal(confirmed.transportRequestId, REQUEST_A);
    assert.equal(confirmed.reservationId, contractReservation.id);
    assert.equal(confirmed.capacityAssignmentId, ASSIGNMENT_A);
    assert.equal(confirmed.confirmedByUserId, USER_A);
    assert.ok(confirmed.confirmedAt);
    assert.equal(confirmed.commercialTerms.currencyCode, 'BRL');
    assert.equal(confirmed.commercialTerms.freightAmount, '15750.00');
    assert.equal(confirmed.commercialTerms.tollAmount, '313.80');
    assert.equal(confirmed.commercialTerms.additionalAmount, '100.00');
    assert.equal(confirmed.commercialTerms.totalAmount, '16163.80');
    assert.equal(confirmed.commercialTerms.paymentTerms, '50% coleta / 50% entrega');
    assert.deepEqual(
      confirmed.events.map((event) => event.type),
      ['confirmed'],
    );

    await assert.rejects(
      contracts.confirm(contractReservation.id),
      /already has a contract decision|Only an active capacity reservation can be contracted|cannot be contracted/,
    );

    const contractedStatus = await requestStatus(database, tenantContext, REQUEST_A);
    assert.equal(contractedStatus, 'contracted');

    const cancelled = await contracts.cancel(confirmed.id, {
      reason: 'Operational cancellation before trip creation',
    });
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.cancelReason, 'Operational cancellation before trip creation');
    assert.equal(cancelled.cancelledByUserId, USER_A);
    assert.ok(cancelled.cancelledAt);
    assert.equal(cancelled.commercialTerms.freightAmount, '15750.00');
    assert.equal(cancelled.commercialTerms.paymentTerms, '50% coleta / 50% entrega');
    assert.deepEqual(
      cancelled.events.map((event) => event.type),
      ['confirmed', 'cancelled'],
    );

    assert.equal(await requestStatus(database, tenantContext, REQUEST_A), 'in_negotiation');
    const cancelledReservation = (await reservations.list(REQUEST_A)).find(
      (reservation) => reservation.id === contractReservation.id,
    );
    assert.equal(cancelledReservation?.status, 'cancelled');

    const replacementReservation = await reservations.approve(accepted.id);
    const replacement = await contracts.confirm(replacementReservation.id);
    assert.equal(replacement.status, 'confirmed');
    assert.notEqual(replacement.id, confirmed.id);
    assert.equal(replacement.commercialTerms.freightAmount, '15750.00');
    assert.equal(replacement.commercialTerms.paymentTerms, '50% coleta / 50% entrega');
    assert.equal(await requestStatus(database, tenantContext, REQUEST_A), 'contracted');

    const history = await contracts.list(REQUEST_A);
    assert.equal(history.length, 3);
    assert.equal(history.filter((contract) => contract.status === 'refused').length, 1);
    assert.equal(history.filter((contract) => contract.status === 'cancelled').length, 1);
    assert.equal(history.filter((contract) => contract.status === 'confirmed').length, 1);
  } finally {
    await database.onModuleDestroy();
  }
}

async function requestStatus(
  database: TenantDatabaseService,
  tenantContext: TenantContext,
  requestId: string,
): Promise<string> {
  return database.withTenantContext(tenantContext.require(), async (client) => {
    const result = await client.query<{ status: string }>(
      'SELECT status::text AS status FROM transport_requests WHERE id=$1::uuid',
      [requestId],
    );
    return result.rows[0]?.status ?? '';
  });
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
