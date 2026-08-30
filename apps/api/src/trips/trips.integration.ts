import assert from 'node:assert/strict';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { TripsService } from './trips.service.js';

const TENANT_A = '61000000-0000-4000-8000-000000000001';
const TENANT_B = '61000000-0000-4000-8000-000000000002';
const USER_A = '61000000-0000-4000-8000-000000000101';
const USER_B = '61000000-0000-4000-8000-000000000102';
const CONTRACT_A = '62000000-0000-4000-8000-000000000901';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();

  const contextA = new TenantContext();
  contextA.establish({
    subject: 'integration|trips-user-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });
  const tripsA = new TripsService(contextA, database);

  const contextB = new TenantContext();
  contextB.establish({
    subject: 'integration|trips-user-b',
    tenantId: TENANT_B,
    userId: USER_B,
  });
  const tripsB = new TripsService(contextB, database);

  try {
    const created = await tripsA.create({
      code: 'TRIP-INTEGRATION-001',
      contractIds: [CONTRACT_A],
      plannedStartAt: '2026-09-10T07:00:00Z',
      plannedEndAt: '2026-09-11T20:00:00Z',
      notes: 'Wave 0022 real Neon integration trip',
    });

    assert.equal(created.code, 'TRIP-INTEGRATION-001');
    assert.equal(created.status, 'planned');

    const requests = await tripsA.listRequests(created.id);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.transportContractId, CONTRACT_A);

    const stops = await tripsA.listStops(created.id);
    assert.equal(stops.length, 2);

    const drivers = await tripsA.listDrivers(created.id);
    assert.equal(drivers.length, 1);
    assert.equal(drivers[0]?.role, 'primary');

    const assets = await tripsA.listAssets(created.id);
    assert.equal(assets.length, 1);
    assert.equal(assets[0]?.role, 'vehicle');

    const initialHistory = await tripsA.listStatusHistory(created.id);
    assert.equal(initialHistory.length, 1);
    assert.equal(initialHistory[0]?.to_status, 'planned');

    const ready = await tripsA.setStatus(created.id, { status: 'ready' });
    assert.equal(ready.status, 'ready');

    const inTransit = await tripsA.setStatus(created.id, { status: 'in_transit' });
    assert.equal(inTransit.status, 'in_transit');
    assert.ok(inTransit.actualStartAt);

    const completed = await tripsA.setStatus(created.id, { status: 'completed' });
    assert.equal(completed.status, 'completed');
    assert.ok(completed.actualEndAt);

    const finalHistory = await tripsA.listStatusHistory(created.id);
    assert.deepEqual(
      finalHistory.map((event) => event.to_status),
      ['planned', 'ready', 'in_transit', 'completed'],
    );

    const tenantAList = await tripsA.list();
    assert.equal(tenantAList.length, 1);
    assert.equal(tenantAList[0]?.id, created.id);

    const tenantBList = await tripsB.list();
    assert.equal(tenantBList.length, 0);
    await assert.rejects(tripsB.get(created.id), /Trip not found in current tenant/);
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
