import assert from 'node:assert/strict';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { TripExecutionService } from './trip-execution.service.js';
import { TripsService } from './trips.service.js';

const TENANT_A = '61000000-0000-4000-8000-000000000001';
const TENANT_B = '61000000-0000-4000-8000-000000000002';
const USER_A = '61000000-0000-4000-8000-000000000101';
const USER_B = '61000000-0000-4000-8000-000000000102';
const CARRIER_A = '62000000-0000-4000-8000-000000000501';
const SHIPPER_A = '62000000-0000-4000-8000-000000000502';
const CONSIGNEE_A = '62000000-0000-4000-8000-000000000503';
const ORIGIN_ADDRESS_A = '62000000-0000-4000-8000-000000000601';
const DESTINATION_ADDRESS_A = '62000000-0000-4000-8000-000000000602';
const DRIVER_A = '62000000-0000-4000-8000-000000000801';
const VEHICLE_A = '62000000-0000-4000-8000-000000000811';
const ASSIGNMENT_A = '62000000-0000-4000-8000-000000000821';
const RESERVATION_A = '62000000-0000-4000-8000-000000000841';
const CONTRACT_A = '62000000-0000-4000-8000-000000000901';
const REQUEST_B = '62000000-0000-4000-8000-000000000702';
const PICKUP_B = '62000000-0000-4000-8000-000000000713';
const DELIVERY_B = '62000000-0000-4000-8000-000000000714';
const PROPOSAL_B = '62000000-0000-4000-8000-000000000832';
const RESERVATION_B = '62000000-0000-4000-8000-000000000842';
const CONTRACT_B = '62000000-0000-4000-8000-000000000902';

async function run(): Promise<void> {
  const database = new TenantDatabaseService();

  const contextA = new TenantContext();
  contextA.establish({
    subject: 'integration|trips-user-a',
    tenantId: TENANT_A,
    userId: USER_A,
  });
  const tripsA = new TripsService(contextA, database);
  const executionA = new TripExecutionService(contextA, database);

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
      notes: 'Wave 0022/0023 and NEX-44 real Neon integration trip',
    });

    assert.equal(created.code, 'TRIP-INTEGRATION-001');
    assert.equal(created.status, 'planned');

    const requests = await tripsA.listRequests(created.id);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.transportContractId, CONTRACT_A);

    const stops = await tripsA.listStops(created.id);
    assert.equal(stops.length, 2);
    const pickup = stops.find((stop) => stop.type === 'pickup');
    const delivery = stops.find((stop) => stop.type === 'delivery');
    assert.ok(pickup?.id);
    assert.ok(delivery?.id);
    const pickupId = String(pickup.id);
    const deliveryId = String(delivery.id);

    const drivers = await tripsA.listDrivers(created.id);
    assert.equal(drivers.length, 1);
    assert.equal(drivers[0]?.role, 'primary');

    const assets = await tripsA.listAssets(created.id);
    assert.equal(assets.length, 1);
    assert.equal(assets[0]?.role, 'vehicle');

    const initialHistory = await tripsA.listStatusHistory(created.id);
    assert.equal(initialHistory.length, 1);
    assert.equal(initialHistory[0]?.to_status, 'planned');

    const checklist = await executionA.createChecklist(created.id, {
      tripStopId: deliveryId,
      category: 'delivery',
      itemCode: 'DELIVERY-CLOSEOUT',
      label: 'Confirm mandatory delivery closeout',
      required: true,
    });
    assert.equal(checklist.status, 'pending');

    await database.withTenantContext(contextA.require(), async (client) => {
      await client.query(
        `INSERT INTO driver_availability (
           tenant_id,driver_id,status,available_from,created_by_user_id,updated_by_user_id
         ) VALUES (current_setting('app.tenant_id')::uuid,$1::uuid,'assigned',now(),$2::uuid,$2::uuid)
         ON CONFLICT (tenant_id,driver_id) DO UPDATE
           SET status='assigned',available_from=excluded.available_from,available_until=NULL,
               updated_by_user_id=excluded.updated_by_user_id,updated_at=now()`,
        [DRIVER_A, USER_A],
      );
      await client.query(
        `INSERT INTO capacity_asset_availability (
           tenant_id,asset_id,status,available_from,created_by_user_id,updated_by_user_id
         ) VALUES (current_setting('app.tenant_id')::uuid,$1::uuid,'assigned',now(),$2::uuid,$2::uuid)
         ON CONFLICT (tenant_id,asset_id) DO UPDATE
           SET status='assigned',available_from=excluded.available_from,available_until=NULL,
               updated_by_user_id=excluded.updated_by_user_id,updated_at=now()`,
        [VEHICLE_A, USER_A],
      );
    });

    const ready = await tripsA.setStatus(created.id, { status: 'ready' });
    assert.equal(ready.status, 'ready');

    const inTransit = await tripsA.setStatus(created.id, { status: 'in_transit' });
    assert.equal(inTransit.status, 'in_transit');
    assert.ok(inTransit.actualStartAt);

    await assert.rejects(
      tripsA.setStatus(created.id, { status: 'completed' }),
      /required stops are pending/,
    );

    await executionA.createCheckin(created.id, {
      tripStopId: pickupId,
      checkinType: 'pickup',
      source: 'mobile',
      occurredAt: '2026-09-10T08:10:00Z',
      notes: 'Cargo collected for NEX-44 closeout gate',
    });
    await executionA.createCheckin(created.id, {
      tripStopId: deliveryId,
      checkinType: 'delivery',
      source: 'mobile',
      occurredAt: '2026-09-11T16:15:00Z',
      notes: 'Cargo delivered for NEX-44 closeout gate',
    });

    await assert.rejects(
      tripsA.setStatus(created.id, { status: 'completed' }),
      /required checklist items are pending or failed/,
    );

    const checklistCompleted = await executionA.setChecklistStatus(
      created.id,
      String(checklist.id),
      { status: 'completed' },
    );
    assert.equal(checklistCompleted.status, 'completed');

    const completed = await tripsA.setStatus(created.id, { status: 'completed' });
    assert.equal(completed.status, 'completed');
    assert.ok(completed.actualEndAt);

    const finalizedDrivers = await tripsA.listDrivers(created.id);
    const finalizedAssets = await tripsA.listAssets(created.id);
    assert.ok(finalizedDrivers[0]?.ends_at);
    assert.ok(finalizedAssets[0]?.ends_at);

    await database.withTenantContext(contextA.require(), async (client) => {
      const contract = await client.query<{
        status: string;
        fulfilled_by_user_id: string | null;
        fulfilled_at: Date | null;
      }>(
        `SELECT status::text AS status,fulfilled_by_user_id::text AS fulfilled_by_user_id,fulfilled_at
           FROM transport_contracts WHERE id=$1::uuid`,
        [CONTRACT_A],
      );
      assert.equal(contract.rows[0]?.status, 'fulfilled');
      assert.equal(contract.rows[0]?.fulfilled_by_user_id, USER_A);
      assert.ok(contract.rows[0]?.fulfilled_at);

      const reservation = await client.query<{
        status: string;
        released_by_user_id: string | null;
        released_at: Date | null;
      }>(
        `SELECT status::text AS status,released_by_user_id::text AS released_by_user_id,released_at
           FROM capacity_reservations WHERE id=$1::uuid`,
        [RESERVATION_A],
      );
      assert.equal(reservation.rows[0]?.status, 'released');
      assert.equal(reservation.rows[0]?.released_by_user_id, USER_A);
      assert.ok(reservation.rows[0]?.released_at);

      const driverAvailability = await client.query<{ status: string }>(
        `SELECT status FROM driver_availability WHERE driver_id=$1::uuid`,
        [DRIVER_A],
      );
      const assetAvailability = await client.query<{ status: string }>(
        `SELECT status FROM capacity_asset_availability WHERE asset_id=$1::uuid`,
        [VEHICLE_A],
      );
      assert.equal(driverAvailability.rows[0]?.status, 'available');
      assert.equal(assetAvailability.rows[0]?.status, 'available');

      await client.query(
        `INSERT INTO transport_requests (
           id,tenant_id,customer_party_id,shipper_party_id,consignee_party_id,
           origin_address_id,destination_address_id,planned_pickup_at,planned_delivery_at,
           cargo_description,status,created_by_user_id,updated_by_user_id
         ) VALUES (
           $1::uuid,current_setting('app.tenant_id')::uuid,$2::uuid,$2::uuid,$3::uuid,
           $4::uuid,$5::uuid,'2026-09-12T08:00:00Z','2026-09-13T18:00:00Z',
           'NEX-44 reusable capacity cargo','contracted',$6::uuid,$6::uuid
         )`,
        [REQUEST_B, SHIPPER_A, CONSIGNEE_A, ORIGIN_ADDRESS_A, DESTINATION_ADDRESS_A, USER_A],
      );
      await client.query(
        `INSERT INTO transport_request_stops (
           id,tenant_id,transport_request_id,sequence,type,party_id,address_id,
           window_start_at,window_end_at,instructions
         ) VALUES
           ($1::uuid,current_setting('app.tenant_id')::uuid,$3::uuid,1,'pickup',$4::uuid,$5::uuid,
            '2026-09-12T08:00:00Z','2026-09-12T10:00:00Z','Second trip pickup'),
           ($2::uuid,current_setting('app.tenant_id')::uuid,$3::uuid,2,'delivery',$6::uuid,$7::uuid,
            '2026-09-13T16:00:00Z','2026-09-13T18:00:00Z','Second trip delivery')`,
        [
          PICKUP_B,
          DELIVERY_B,
          REQUEST_B,
          SHIPPER_A,
          ORIGIN_ADDRESS_A,
          CONSIGNEE_A,
          DESTINATION_ADDRESS_A,
        ],
      );
      await client.query(
        `INSERT INTO freight_proposals (
           id,tenant_id,transport_request_id,capacity_assignment_id,carrier_party_id,
           sequence,kind,currency_code,freight_amount,toll_amount,additional_amount,
           payment_terms,commercial_notes,authored_by_user_id
         ) VALUES (
           $1::uuid,current_setting('app.tenant_id')::uuid,$2::uuid,$3::uuid,$4::uuid,
           1,'proposal','BRL',16000,320,0,'50% pickup / 50% delivery',
           'NEX-44 capacity reuse proposal',$5::uuid
         )`,
        [PROPOSAL_B, REQUEST_B, ASSIGNMENT_A, CARRIER_A, USER_A],
      );
      await client.query(
        `INSERT INTO freight_proposal_events (tenant_id,proposal_id,status,actor_user_id)
         VALUES (current_setting('app.tenant_id')::uuid,$1::uuid,'accepted',$2::uuid)`,
        [PROPOSAL_B, USER_A],
      );
      await client.query(
        `INSERT INTO capacity_reservations (
           id,tenant_id,transport_request_id,proposal_id,capacity_assignment_id,driver_id,vehicle_id,
           carrier_party_id,status,approved_by_user_id,approved_at
         ) VALUES (
           $1::uuid,current_setting('app.tenant_id')::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,
           $7::uuid,'active',$8::uuid,now()
         )`,
        [
          RESERVATION_B,
          REQUEST_B,
          PROPOSAL_B,
          ASSIGNMENT_A,
          DRIVER_A,
          VEHICLE_A,
          CARRIER_A,
          USER_A,
        ],
      );
      await client.query(
        `INSERT INTO capacity_reservation_events (tenant_id,reservation_id,type,actor_user_id)
         VALUES (current_setting('app.tenant_id')::uuid,$1::uuid,'approved',$2::uuid)`,
        [RESERVATION_B, USER_A],
      );
      await client.query(
        `INSERT INTO transport_contracts (
           id,tenant_id,transport_request_id,reservation_id,proposal_id,capacity_assignment_id,
           driver_id,vehicle_id,carrier_party_id,status,currency_code,freight_amount,toll_amount,
           additional_amount,payment_terms,commercial_notes,confirmed_by_user_id,confirmed_at
         ) VALUES (
           $1::uuid,current_setting('app.tenant_id')::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,
           $6::uuid,$7::uuid,$8::uuid,'confirmed','BRL',16000,320,0,
           '50% pickup / 50% delivery','NEX-44 reusable confirmed contract',$9::uuid,now()
         )`,
        [
          CONTRACT_B,
          REQUEST_B,
          RESERVATION_B,
          PROPOSAL_B,
          ASSIGNMENT_A,
          DRIVER_A,
          VEHICLE_A,
          CARRIER_A,
          USER_A,
        ],
      );
      await client.query(
        `INSERT INTO transport_contract_events (tenant_id,contract_id,type,actor_user_id)
         VALUES (current_setting('app.tenant_id')::uuid,$1::uuid,'confirmed',$2::uuid)`,
        [CONTRACT_B, USER_A],
      );
      await client.query(
        `UPDATE driver_availability
            SET status='assigned',updated_by_user_id=$2::uuid,updated_at=now()
          WHERE driver_id=$1::uuid`,
        [DRIVER_A, USER_A],
      );
      await client.query(
        `UPDATE capacity_asset_availability
            SET status='assigned',updated_by_user_id=$2::uuid,updated_at=now()
          WHERE asset_id=$1::uuid`,
        [VEHICLE_A, USER_A],
      );
    });

    const secondTrip = await tripsA.create({
      code: 'TRIP-INTEGRATION-002',
      contractIds: [CONTRACT_B],
      plannedStartAt: '2026-09-12T07:00:00Z',
      plannedEndAt: '2026-09-13T20:00:00Z',
      notes: 'NEX-44 cancellation and capacity release verification',
    });
    const secondReady = await tripsA.setStatus(secondTrip.id, { status: 'ready' });
    assert.equal(secondReady.status, 'ready');

    const cancellationReason = 'Customer cancelled before departure';
    const cancelled = await tripsA.setStatus(secondTrip.id, {
      status: 'cancelled',
      reason: cancellationReason,
    });
    assert.equal(cancelled.status, 'cancelled');

    await database.withTenantContext(contextA.require(), async (client) => {
      const contract = await client.query<{ status: string; cancel_reason: string | null }>(
        `SELECT status::text AS status,cancel_reason FROM transport_contracts WHERE id=$1::uuid`,
        [CONTRACT_B],
      );
      const reservation = await client.query<{ status: string; cancel_reason: string | null }>(
        `SELECT status::text AS status,cancel_reason FROM capacity_reservations WHERE id=$1::uuid`,
        [RESERVATION_B],
      );
      assert.equal(contract.rows[0]?.status, 'cancelled');
      assert.equal(contract.rows[0]?.cancel_reason, cancellationReason);
      assert.equal(reservation.rows[0]?.status, 'cancelled');
      assert.equal(reservation.rows[0]?.cancel_reason, cancellationReason);

      const driverAvailability = await client.query<{ status: string }>(
        `SELECT status FROM driver_availability WHERE driver_id=$1::uuid`,
        [DRIVER_A],
      );
      const assetAvailability = await client.query<{ status: string }>(
        `SELECT status FROM capacity_asset_availability WHERE asset_id=$1::uuid`,
        [VEHICLE_A],
      );
      assert.equal(driverAvailability.rows[0]?.status, 'available');
      assert.equal(assetAvailability.rows[0]?.status, 'available');
    });

    const finalHistory = await tripsA.listStatusHistory(created.id);
    assert.deepEqual(
      finalHistory.map((event) => event.to_status),
      ['planned', 'ready', 'in_transit', 'completed'],
    );

    const tenantAList = await tripsA.list();
    assert.equal(tenantAList.length, 2);
    assert.ok(tenantAList.some((trip) => trip.id === created.id));
    assert.ok(tenantAList.some((trip) => trip.id === secondTrip.id));

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
