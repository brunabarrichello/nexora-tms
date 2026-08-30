import assert from 'node:assert/strict';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { NegotiationCollaborationService } from './negotiation-collaboration.service.js';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const REQUEST_A = 'a1200000-0000-4000-8000-000000000001';
const EXTERNAL_PARTY_A = 'a1000000-0000-4000-8000-000000000001';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();
  const contextA = new TenantContext();
  contextA.establish({
    subject: 'integration|negotiation-user-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });
  const negotiationA = new NegotiationCollaborationService(contextA, database);

  try {
    const thread = await negotiationA.createThread(REQUEST_A, {
      subject: 'Commercial negotiation for API integration',
    });

    assert.equal(thread.transportRequestId, REQUEST_A);
    assert.equal(thread.status, 'open');
    assert.equal(thread.createdBy.membershipId, 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');

    const initialParticipants = await negotiationA.listParticipants(thread.id);
    assert.equal(initialParticipants.length, 1);
    assert.equal(initialParticipants[0]?.kind, 'internal');
    assert.equal(initialParticipants[0]?.role, 'operator');

    const external = await negotiationA.addParticipant(thread.id, {
      kind: 'external',
      role: 'observer',
      businessPartyId: EXTERNAL_PARTY_A,
    });
    assert.equal(external.kind, 'external');
    assert.equal(external.businessParty?.id, EXTERNAL_PARTY_A);
    assert.equal(external.leftAt, null);

    const first = await negotiationA.createMessage(thread.id, {
      kind: 'message',
      body: 'Initial commercial message',
    });
    assert.equal(first.kind, 'message');
    assert.equal(first.replyToMessageId, null);
    assert.ok(first.authorParticipantId);

    const reply = await negotiationA.createMessage(thread.id, {
      kind: 'note',
      body: 'Internal follow-up note',
      replyToMessageId: first.id,
    });
    assert.equal(reply.kind, 'note');
    assert.equal(reply.replyToMessageId, first.id);

    const messages = await negotiationA.listMessages(thread.id);
    assert.deepEqual(
      messages.map((message) => message.id),
      [first.id, reply.id],
    );

    const removed = await negotiationA.removeParticipant(thread.id, external.id);
    assert.ok(removed.leftAt);

    const contextB = new TenantContext();
    contextB.establish({
      subject: 'integration|negotiation-user-b',
      tenantId: TENANT_B,
      userId: USER_B,
    });
    const negotiationB = new NegotiationCollaborationService(contextB, database);
    await assert.rejects(negotiationB.getThread(thread.id), /not found in current tenant/i);

    const closed = await negotiationA.setThreadStatus(thread.id, { status: 'closed' });
    assert.equal(closed.status, 'closed');
    assert.ok(closed.closedAt);

    await assert.rejects(
      negotiationA.createMessage(thread.id, {
        kind: 'message',
        body: 'Must not be accepted after close',
      }),
      /already closed/i,
    );

    await assert.rejects(
      negotiationA.addParticipant(thread.id, {
        kind: 'external',
        role: 'observer',
        businessPartyId: EXTERNAL_PARTY_A,
      }),
      /already closed/i,
    );
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
