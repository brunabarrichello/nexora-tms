import assert from 'node:assert/strict';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { TripOccurrenceService } from './trip-occurrence.service.js';

const TENANT_A = '73000000-0000-4000-8000-000000000001';
const TENANT_B = '73000000-0000-4000-8000-000000000002';
const USER_A = '73000000-0000-4000-8000-000000000101';
const USER_B = '73000000-0000-4000-8000-000000000102';
const TRIP_A = '74000000-0000-4000-8000-000000000001';
const STOP_A = '74000000-0000-4000-8000-000000000011';
const DOCUMENT_A = '74000000-0000-4000-8000-000000000021';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();

  const contextA = new TenantContext();
  contextA.establish({
    subject: 'integration|trip-occurrence-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });
  const occurrencesA = new TripOccurrenceService(contextA, database);

  const contextB = new TenantContext();
  contextB.establish({
    subject: 'integration|trip-occurrence-b',
    tenantId: TENANT_B,
    userId: USER_B,
  });
  const occurrencesB = new TripOccurrenceService(contextB, database);

  try {
    const occurrence = await occurrencesA.create(TRIP_A, {
      tripStopId: STOP_A,
      occurrenceType: 'delay',
      severity: 'high',
      occurredAt: '2026-09-02T13:00:00Z',
      latitude: -23.55,
      longitude: -46.63,
      locationText: 'SP-001 km 25',
      description: 'Traffic interruption caused a material delay',
      responsibleUserId: USER_A,
    });
    assert.equal(occurrence.status, 'open');
    assert.equal(occurrence.severity, 'high');
    assert.equal(occurrence.responsible_user_id, USER_A);

    assert.equal((await occurrencesA.list(TRIP_A)).length, 1);
    assert.equal((await occurrencesA.get(TRIP_A, String(occurrence.id))).id, occurrence.id);

    const treated = await occurrencesA.addTreatment(TRIP_A, String(occurrence.id), {
      note: 'Carrier contacted and alternative route requested',
      responsibleUserId: USER_A,
    });
    assert.equal(treated.responsible_user_id, USER_A);

    await assert.rejects(
      occurrencesA.addTreatment(TRIP_A, String(occurrence.id), {
        note: 'Invalid cross-tenant responsibility',
        responsibleUserId: USER_B,
      }),
      /Responsible user must be an active member of the current tenant/,
    );

    const linked = await occurrencesA.linkDocument(TRIP_A, String(occurrence.id), {
      documentId: DOCUMENT_A,
      relationType: 'evidence',
    });
    assert.equal(linked.document_id, DOCUMENT_A);
    assert.equal((await occurrencesA.listDocuments(TRIP_A, String(occurrence.id))).length, 1);

    const resolved = await occurrencesA.setStatus(TRIP_A, String(occurrence.id), {
      status: 'resolved',
      note: 'Traffic released and ETA normalized',
    });
    assert.equal(resolved.status, 'resolved');
    assert.ok(resolved.resolved_at);
    assert.equal(resolved.resolved_by_user_id, USER_A);

    const reopened = await occurrencesA.setStatus(TRIP_A, String(occurrence.id), {
      status: 'open',
      note: 'Delay returned after a second road closure',
    });
    assert.equal(reopened.status, 'open');
    assert.equal(reopened.resolved_at, null);
    assert.equal(reopened.resolved_by_user_id, null);

    const history = await occurrencesA.listHistory(TRIP_A, String(occurrence.id));
    assert.equal(history.length, 4);
    assert.deepEqual(
      history.map((row) => row.action),
      ['created', 'treatment', 'status_changed', 'status_changed'],
    );

    await database.withTenantContext(contextA.require(), async (client) => {
      await assert.rejects(
        client.query(`UPDATE trip_occurrence_history SET note='tampered' WHERE occurrence_id=$1::uuid`, [
          occurrence.id,
        ]),
        /permission denied/i,
      );
    });
    await database.withTenantContext(contextA.require(), async (client) => {
      await assert.rejects(
        client.query(`DELETE FROM trip_occurrences WHERE id=$1::uuid`, [occurrence.id]),
        /permission denied/i,
      );
    });

    await assert.rejects(occurrencesB.list(TRIP_A), /Trip not found in current tenant/);
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
