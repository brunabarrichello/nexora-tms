import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  parseTripAssetCreate,
  parseTripCreate,
  parseTripDriverCreate,
  parseTripRequestLink,
  parseTripStatus,
  parseTripStopCreate,
} from './trips.validation.js';

const contractId = '11111111-1111-4111-8111-111111111111';
const locationA = '22222222-2222-4222-8222-222222222222';
const locationB = '33333333-3333-4333-8333-333333333333';
const requestId = '44444444-4444-4444-8444-444444444444';
const stopId = '55555555-5555-4555-8555-555555555555';
const driverId = '66666666-6666-4666-8666-666666666666';
const assetId = '77777777-7777-4777-8777-777777777777';

test('parses a trip created from confirmed contract references', () => {
  assert.deepEqual(
    parseTripCreate({
      code: '  TRIP-2026-0001 ',
      contractIds: [contractId],
      plannedStartAt: '2026-08-31T09:00:00-03:00',
      plannedEndAt: '2026-09-01T18:00:00-03:00',
      originLocationId: locationA,
      destinationLocationId: locationB,
      notes: '  Operação dedicada  ',
    }),
    {
      code: 'TRIP-2026-0001',
      contractIds: [contractId],
      plannedStartAt: '2026-08-31T12:00:00.000Z',
      plannedEndAt: '2026-09-01T21:00:00.000Z',
      originLocationId: locationA,
      destinationLocationId: locationB,
      notes: 'Operação dedicada',
    },
  );
});

test('rejects duplicate contracts and invalid planned windows', () => {
  assert.throws(
    () =>
      parseTripCreate({
        code: 'TRIP-1',
        contractIds: [contractId, contractId],
        plannedStartAt: '2026-09-01T10:00:00Z',
      }),
    BadRequestException,
  );
  assert.throws(
    () =>
      parseTripCreate({
        code: 'TRIP-2',
        contractIds: [contractId],
        plannedStartAt: '2026-09-02T10:00:00Z',
        plannedEndAt: '2026-09-01T10:00:00Z',
      }),
    BadRequestException,
  );
});

test('requires cancellation reason and accepts normal status transitions', () => {
  assert.deepEqual(parseTripStatus({ status: 'ready' }), { status: 'ready', reason: null });
  assert.throws(() => parseTripStatus({ status: 'cancelled' }), BadRequestException);
  assert.deepEqual(parseTripStatus({ status: 'cancelled', reason: 'Cliente cancelou' }), {
    status: 'cancelled',
    reason: 'Cliente cancelou',
  });
});

test('parses typed trip request link', () => {
  assert.deepEqual(parseTripRequestLink({ contractId, sequence: 2 }), {
    contractId,
    sequence: 2,
  });
  assert.throws(() => parseTripRequestLink({ contractId, sequence: 0 }), BadRequestException);
});

test('requires a location or a source request stop for a trip stop', () => {
  assert.throws(
    () => parseTripStopCreate({ sequence: 1, type: 'pickup' }),
    BadRequestException,
  );
  assert.deepEqual(
    parseTripStopCreate({
      sequence: 1,
      type: 'pickup',
      sourceTransportRequestId: requestId,
      sourceTransportRequestStopId: stopId,
    }),
    {
      sequence: 1,
      type: 'pickup',
      locationId: null,
      sourceTransportRequestId: requestId,
      sourceTransportRequestStopId: stopId,
      plannedArrivalAt: null,
      plannedDepartureAt: null,
      instructions: null,
    },
  );
});

test('parses driver and asset roles with optional start timestamps', () => {
  assert.deepEqual(parseTripDriverCreate({ driverId, role: 'primary' }), {
    driverId,
    role: 'primary',
    startsAt: null,
  });
  assert.deepEqual(parseTripAssetCreate({ assetId, role: 'vehicle' }), {
    assetId,
    role: 'vehicle',
    startsAt: null,
  });
  assert.throws(() => parseTripAssetCreate({ assetId, role: 'aircraft' }), BadRequestException);
});
