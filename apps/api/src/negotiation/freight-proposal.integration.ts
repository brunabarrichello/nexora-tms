import assert from 'node:assert/strict';

import { CapacityMatchingService } from '../matching/capacity-matching.service.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { FreightProposalService } from './freight-proposal.service.js';

const USER_A = '51000000-0000-4000-8000-000000000101';
const TENANT_A = '51000000-0000-4000-8000-000000000001';
const REQUEST_A = '52000000-0000-4000-8000-000000000801';
const ASSIGNMENT_A = '52000000-0000-4000-8000-000000000921';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();
  const tenantContext = new TenantContext();
  tenantContext.establish({
    subject: 'integration|proposal-user-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });
  const matching = new CapacityMatchingService(tenantContext, database);
  const proposals = new FreightProposalService(tenantContext, database, matching);

  try {
    const first = await proposals.create(REQUEST_A, {
      capacityAssignmentId: ASSIGNMENT_A,
      freightAmount: 16000,
      tollAmount: 313.8,
      additionalAmount: 0,
      paymentTerms: '70/30 Pix',
      commercialNotes: 'Initial carrier freight proposal',
    });

    assert.equal(first.sequence, 1);
    assert.equal(first.kind, 'proposal');
    assert.equal(first.parentProposalId, null);
    assert.equal(first.status, 'open');
    assert.equal(first.freightAmount, 16000);
    assert.equal(first.tollAmount, 313.8);
    assert.equal(first.totalAmount, 16313.8);
    assert.equal(first.events.length, 1);
    assert.equal(first.events[0]?.status, 'open');

    const counter = await proposals.counterproposal(first.id, {
      freightAmount: 15750,
      tollAmount: 313.8,
      additionalAmount: 100,
      paymentTerms: '50% coleta / 50% entrega',
      commercialNotes: 'Counterproposal preserving the original version',
    });

    assert.equal(counter.sequence, 2);
    assert.equal(counter.kind, 'counterproposal');
    assert.equal(counter.parentProposalId, first.id);
    assert.equal(counter.status, 'open');
    assert.equal(counter.freightAmount, 15750);
    assert.equal(counter.totalAmount, 16163.8);

    const accepted = await proposals.setStatus(counter.id, { status: 'accepted' });
    assert.equal(accepted.status, 'accepted');
    assert.deepEqual(
      accepted.events.map((event) => event.status),
      ['open', 'accepted'],
    );

    const history = await proposals.list(REQUEST_A);
    assert.equal(history.length, 2);
    assert.equal(history[0]?.id, first.id);
    assert.equal(history[0]?.status, 'rejected');
    assert.equal(history[0]?.freightAmount, 16000);
    assert.match(history[0]?.statusReason ?? '', /Superseded by counterproposal/);
    assert.equal(history[1]?.id, counter.id);
    assert.equal(history[1]?.status, 'accepted');
    assert.equal(history[1]?.freightAmount, 15750);

    await assert.rejects(
      proposals.setStatus(counter.id, {
        status: 'rejected',
        reason: 'Must not overwrite an accepted proposal',
      }),
      /Proposal is already accepted/,
    );
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
