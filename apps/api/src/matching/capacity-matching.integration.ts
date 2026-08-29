import { strict as assert } from 'node:assert';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { CapacityMatchingService } from './capacity-matching.service.js';

const USER_A = '51000000-0000-4000-8000-000000000101';
const TENANT_A = '51000000-0000-4000-8000-000000000001';
const REQUEST_A = '52000000-0000-4000-8000-000000000801';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();
  const tenantContext = new TenantContext();
  tenantContext.establish({
    subject: 'integration|matching-user-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });
  const matching = new CapacityMatchingService(tenantContext, database);

  try {
    const result = await matching.search(REQUEST_A);

    assert.equal(result.transportRequestId, REQUEST_A);
    assert.equal(
      result.summary.evaluated,
      3,
      'tenant A must evaluate exactly three active compositions',
    );
    assert.equal(result.summary.compatible, 1, 'exactly one composition must be compatible');
    assert.equal(result.summary.incompatible, 2, 'exactly two compositions must be incompatible');

    const compatible = result.compatible[0];
    assert.ok(compatible, 'compatible capacity candidate must be returned');
    assert.equal(compatible.vehicle.identifier, 'MATCH-COMPATIBLE');
    assert.deepEqual(compatible.reasons, []);

    const capabilityMismatch = result.incompatible.find(
      (candidate) => candidate.vehicle.identifier === 'MATCH-INCOMPATIBLE',
    );
    assert.ok(capabilityMismatch, 'capability mismatch candidate must be returned');
    assert.deepEqual(
      capabilityMismatch.reasons.map((reason) => reason.code),
      [
        'vehicle_type_mismatch',
        'body_type_mismatch',
        'weight_capacity_insufficient',
        'volume_capacity_insufficient',
        'length_capacity_insufficient',
        'width_capacity_insufficient',
        'height_capacity_insufficient',
        'tracking_unavailable',
      ],
    );

    const blockedDriver = result.incompatible.find(
      (candidate) => candidate.vehicle.identifier === 'MATCH-BLOCKED-DRIVER',
    );
    assert.ok(blockedDriver, 'blocked driver composition must be returned as incompatible');
    assert.deepEqual(
      blockedDriver.reasons.map((reason) => reason.code),
      ['driver_not_active'],
    );

    assert.equal(result.requirements.vehicleType, 'carreta');
    assert.equal(result.requirements.bodyType, 'sider');
    assert.equal(result.requirements.totalWeightKg, 5000);
    assert.equal(result.requirements.trackingRequired, true);
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
