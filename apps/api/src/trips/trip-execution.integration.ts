import assert from 'node:assert/strict';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { TripExecutionService } from './trip-execution.service.js';
import { TripsService } from './trips.service.js';

const TENANT_A = '71000000-0000-4000-8000-000000000001';
const TENANT_B = '71000000-0000-4000-8000-000000000002';
const USER_A = '71000000-0000-4000-8000-000000000101';
const USER_B = '71000000-0000-4000-8000-000000000102';
const TRIP_A = '72000000-0000-4000-8000-000000000001';
const PICKUP_STOP = '72000000-0000-4000-8000-000000000011';
const DELIVERY_STOP = '72000000-0000-4000-8000-000000000012';
const DOCUMENT_A = '72000000-0000-4000-8000-000000000021';
const CURRENCY_BRL = '72000000-0000-4000-8000-000000000031';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();

  const contextA = new TenantContext();
  contextA.establish({
    subject: 'integration|trip-execution-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });
  const executionA = new TripExecutionService(contextA, database);
  const tripsA = new TripsService(contextA, database);

  const contextB = new TenantContext();
  contextB.establish({
    subject: 'integration|trip-execution-b',
    tenantId: TENANT_B,
    userId: USER_B,
  });
  const executionB = new TripExecutionService(contextB, database);
  const tripsB = new TripsService(contextB, database);

  try {
    const checklist = await executionA.createChecklist(TRIP_A, {
      tripStopId: PICKUP_STOP,
      category: 'pickup',
      itemCode: 'SEAL-CHECK',
      label: 'Confirm cargo seal',
      required: true,
    });
    assert.equal(checklist.status, 'pending');

    const checklistCompleted = await executionA.setChecklistStatus(TRIP_A, String(checklist.id), {
      status: 'completed',
    });
    assert.equal(checklistCompleted.status, 'completed');

    const arrival = await executionA.createCheckin(TRIP_A, {
      tripStopId: PICKUP_STOP,
      checkinType: 'arrival',
      source: 'mobile',
      occurredAt: '2026-09-10T07:45:00Z',
      latitude: -23.55052,
      longitude: -46.633308,
      notes: 'Arrived at pickup',
    });
    assert.equal(arrival.checkin_type, 'arrival');

    const afterArrival = await tripsA.listStops(TRIP_A);
    const pickupAfterArrival = afterArrival.find((stop) => stop.id === PICKUP_STOP);
    assert.equal(pickupAfterArrival?.status, 'arrived');
    assert.ok(pickupAfterArrival?.actual_arrival_at);

    await executionA.createCheckin(TRIP_A, {
      tripStopId: PICKUP_STOP,
      checkinType: 'pickup',
      source: 'mobile',
      occurredAt: '2026-09-10T08:10:00Z',
      notes: 'Cargo collected',
    });

    const inTransit = await tripsA.get(TRIP_A);
    assert.equal(inTransit.status, 'in_transit');
    assert.ok(inTransit.actualStartAt);

    const pickupAfterCollection = (await tripsA.listStops(TRIP_A)).find(
      (stop) => stop.id === PICKUP_STOP,
    );
    assert.equal(pickupAfterCollection?.status, 'departed');
    assert.ok(pickupAfterCollection?.actual_departure_at);

    const position = await executionA.createLocation(TRIP_A, {
      source: 'integration',
      provider: 'wave-0023-gps',
      providerEventId: 'position-001',
      latitude: -23.4,
      longitude: -46.2,
      accuracyM: 15,
      speedKmh: 62.5,
      headingDegrees: 90,
      recordedAt: '2026-08-30T20:00:00Z',
      metadata: { satelliteCount: 12 },
    });
    assert.equal(position.provider, 'wave-0023-gps');

    await assert.rejects(
      executionA.createLocation(TRIP_A, {
        source: 'integration',
        provider: 'wave-0023-gps',
        providerEventId: 'position-001',
        latitude: -23.4,
        longitude: -46.2,
        recordedAt: '2026-08-30T20:00:00Z',
      }),
      /already ingested/,
    );

    await executionA.createEvent(TRIP_A, {
      eventType: 'delay',
      source: 'manual',
      title: 'Traffic delay',
      description: 'Heavy traffic on route',
      occurredAt: '2026-09-10T10:00:00Z',
      metadata: { estimatedMinutes: 20 },
    });

    const deliveryDocument = await executionA.linkDocument(TRIP_A, {
      tripStopId: DELIVERY_STOP,
      documentId: DOCUMENT_A,
      relationType: 'delivery_proof',
    });
    const expenseDocument = await executionA.linkDocument(TRIP_A, {
      documentId: DOCUMENT_A,
      relationType: 'expense_receipt',
    });
    const tollDocument = await executionA.linkDocument(TRIP_A, {
      documentId: DOCUMENT_A,
      relationType: 'toll_receipt',
    });
    const fuelDocument = await executionA.linkDocument(TRIP_A, {
      documentId: DOCUMENT_A,
      relationType: 'fuel_receipt',
    });

    const deliveryProof = await executionA.createProof(TRIP_A, {
      tripStopId: DELIVERY_STOP,
      tripDocumentId: String(deliveryDocument.id),
      proofType: 'delivery',
      capturedAt: '2026-09-11T16:00:00Z',
      source: 'mobile',
      notes: 'Signed delivery receipt',
    });

    await executionA.createCheckin(TRIP_A, {
      tripStopId: DELIVERY_STOP,
      checkinType: 'delivery',
      source: 'mobile',
      occurredAt: '2026-09-11T16:05:00Z',
      notes: 'Delivery completed',
    });

    const pod = await executionA.createDeliveryProof(TRIP_A, {
      tripStopId: DELIVERY_STOP,
      tripProofId: String(deliveryProof.id),
      receivedByName: 'Gate Receiver',
      receivedByRole: 'Warehouse supervisor',
      deliveredAt: '2026-09-11T16:05:00Z',
      status: 'accepted',
    });
    assert.equal(pod.status, 'accepted');

    const expense = await executionA.createExpense(TRIP_A, {
      tripDocumentId: String(expenseDocument.id),
      category: 'parking',
      amount: 45.5,
      currencyId: CURRENCY_BRL,
      incurredAt: '2026-09-10T11:00:00Z',
      merchant: 'Gate Parking',
    });
    const approvedExpense = await executionA.setExpenseStatus(TRIP_A, String(expense.id), {
      status: 'approved',
    });
    assert.equal(approvedExpense.status, 'approved');

    const toll = await executionA.createToll(TRIP_A, {
      tripDocumentId: String(tollDocument.id),
      plaza: 'Gate Toll Plaza',
      road: 'SP-001',
      amount: 28.4,
      currencyId: CURRENCY_BRL,
      occurredAt: '2026-09-10T12:00:00Z',
      paymentMethod: 'tag',
      tagReference: 'TAG-GATE-001',
    });
    assert.equal(toll.payment_method, 'tag');

    const fuel = await executionA.createFuel(TRIP_A, {
      tripDocumentId: String(fuelDocument.id),
      fuelType: 'diesel',
      liters: 100,
      unitPrice: 6.25,
      totalAmount: 625,
      currencyId: CURRENCY_BRL,
      odometerKm: 123456.7,
      station: 'Gate Fuel',
      fueledAt: '2026-09-10T13:00:00Z',
    });
    assert.equal(Number(fuel.total_amount), 625);

    assert.ok((await executionA.listEvents(TRIP_A)).length >= 3);
    assert.equal((await executionA.listLocations(TRIP_A)).length, 1);
    assert.equal((await executionA.listDeliveryProofs(TRIP_A)).length, 1);

    await database.withTenantContext(contextA.require(), async (client) => {
      await assert.rejects(
        client.query(`UPDATE trip_events SET title='tampered' WHERE trip_id=$1::uuid`, [TRIP_A]),
        /permission denied/i,
      );
      await assert.rejects(
        client.query(`DELETE FROM trip_expenses WHERE trip_id=$1::uuid`, [TRIP_A]),
        /permission denied/i,
      );
    });

    assert.equal((await tripsB.list()).length, 0);
    await assert.rejects(executionB.listEvents(TRIP_A), /Trip not found in current tenant/);

    const completed = await tripsA.setStatus(TRIP_A, { status: 'completed' });
    assert.equal(completed.status, 'completed');
    await assert.rejects(
      executionA.createEvent(TRIP_A, {
        eventType: 'note',
        title: 'Late mutation',
        occurredAt: '2026-09-11T17:00:00Z',
      }),
      /not allowed while status is completed/,
    );
  } finally {
    await database.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
