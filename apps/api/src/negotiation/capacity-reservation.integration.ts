import assert from 'node:assert/strict';

import {
  CapacityMatchingService,
} from '../matching/capacity-matching.service.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { CapacityReservationService } from './capacity-reservation.service.js';
import { FreightProposalService } from './freight-proposal.service.js';

const USER_A = '51000000-0000-4000-8000-000000000101';
const TENANT_A = '51000000-0000-4000-8000-000000000001';
const REQUEST_A = '52000000-0000-4000-8000-000000000801';
const ASSIGNMENT_A = '52000000-0000-4000-8000-000000000921';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();
  const tenantContext = new TenantContext();
  tenantContext.establish({
    subject: 'integration|reservation-user-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });

  const matching = new CapacityMatchingService(tenantContext, database);
  const proposals = new FreightProposalService(
    tenantContext,
    database,
    matching,
  );
  const reservations = new CapacityReservationService(
    tenantContext,
    database,
    matching,
  );

  try {
    const proposalHistory = await proposals.list(REQUEST_A);
    const accepted = proposalHistory.find(
      (proposal) => proposal.status === 'accepted',
    );
    assert.ok(accepted, 'NEX-38 integration must leave one accepted proposal');
    assert.equal(accepted.capacityAssignmentId, ASSIGNMENT_A);

    const first = await reservations.approve(accepted.id);
    assert.equal(first.transportRequestId, REQUEST_A);
    assert.equal(first.proposalId, accepted.id);
    assert.equal(first.capacityAssignmentId, ASSIGNMENT_A);
    assert.equal(first.status, 'active');
    assert.equal(first.events.length, 1);
    assert.equal(first.events[0]?.type, 'approved');

    await assert.rejects(
      reservations.approve(accepted.id),
      /already has an active capacity reservation|already reserved/,
    );

    const activeHistory = await reservations.list(REQUEST_A);
    assert.equal(activeHistory.length, 1);
    assert.equal(activeHistory[0]?.id, first.id);
    assert.equal(activeHistory[0]?.status, 'active');

    const cancelled = await reservations.cancel(first.id, {
      reason: 'Integration cancellation releases the reserved capacity',
    });
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(
      cancelled.cancelReason,
      'Integration cancellation releases the reserved capacity',
    );
    assert.deepEqual(
      cancelled.events.map((event) => event.type),
      ['approved', 'cancelled'],
    );

    const replacement = await reservations.approve(accepted.id);
    assert.notEqual(replacement.id, first.id);
    assert.equal(replacement.status, 'active');
    assert.equal(replacement.proposalId, accepted.id);

    const finalHistory = await reservations.list(REQUEST_A);
    const activeReservations = finalHistory.filter(
      (reservation) => reservation.status === 'active',
    );
    const cancelledReservations = finalHistory.filter(
      (reservation) => reservation.status === 'cancelled',
    );
    assert.equal(finalHistory.length, 2);
    assert.equal(activeReservations.length, 1);
    assert.equal(cancelledReservations.length, 1);
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
