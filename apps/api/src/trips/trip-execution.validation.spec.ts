import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseTripCheckin,
  parseTripChecklistStatus,
  parseTripDeliveryProof,
  parseTripExpenseStatus,
  parseTripLocation,
} from './trip-execution.validation.js';

const STOP = '11111111-1111-4111-8111-111111111111';

test('trip execution check-in normalizes timestamp and coordinates', () => {
  const input = parseTripCheckin({
    tripStopId: STOP,
    checkinType: 'arrival',
    source: 'mobile',
    occurredAt: '2026-08-30T12:00:00-03:00',
    latitude: -23.55,
    longitude: -46.63,
  });
  assert.equal(input.occurredAt, '2026-08-30T15:00:00.000Z');
  assert.equal(input.latitude, -23.55);
});

test('trip execution requires coordinate pairs', () => {
  assert.throws(
    () => parseTripCheckin({ tripStopId: STOP, checkinType: 'arrival', occurredAt: new Date().toISOString(), latitude: -23 }),
    /latitude and longitude must be provided together/,
  );
});

test('integration locations require provider and valid heading', () => {
  assert.throws(
    () => parseTripLocation({ source: 'integration', latitude: -23, longitude: -46, recordedAt: new Date().toISOString() }),
    /provider is required/,
  );
  assert.throws(
    () => parseTripLocation({ source: 'gps', latitude: -23, longitude: -46, headingDegrees: 360, recordedAt: new Date().toISOString() }),
    /headingDegrees is invalid/,
  );
});

test('waived checklist requires reason', () => {
  assert.throws(() => parseTripChecklistStatus({ status: 'waived' }), /waiverReason is required/);
});

test('rejected or voided expense requires reason', () => {
  assert.throws(() => parseTripExpenseStatus({ status: 'rejected' }), /reason is required/);
});

test('rejected delivery proof requires exception reason', () => {
  assert.throws(
    () => parseTripDeliveryProof({
      tripStopId: STOP,
      tripProofId: '22222222-2222-4222-8222-222222222222',
      receivedByName: 'Receiver',
      deliveredAt: new Date().toISOString(),
      status: 'rejected',
    }),
    /exceptionReason is required/,
  );
});
