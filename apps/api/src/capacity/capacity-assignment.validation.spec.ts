import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  parseCloseCapacityAssignment,
  parseCreateCapacityAssignment,
  validateAssignmentPeriod,
} from './capacity-assignment.validation.js';

const driverId = '00000000-0000-4000-8000-000000000901';
const vehicleId = '00000000-0000-4000-8000-000000000902';
const carrierPartyId = '00000000-0000-4000-8000-000000000501';

test('parses a valid driver vehicle carrier assignment', () => {
  const parsed = parseCreateCapacityAssignment({
    driverId,
    vehicleId,
    carrierPartyId,
    startsAt: '2026-09-01T08:00:00-03:00',
  });
  assert.equal(parsed.driverId, driverId);
  assert.equal(parsed.vehicleId, vehicleId);
  assert.equal(parsed.carrierPartyId, carrierPartyId);
  assert.equal(parsed.startsAt, '2026-09-01T11:00:00.000Z');
});

test('rejects invalid assignment identifiers', () => {
  assert.throws(
    () => parseCreateCapacityAssignment({ driverId: 'x', vehicleId, carrierPartyId }),
    BadRequestException,
  );
});

test('requires cancellation reason', () => {
  assert.throws(() => parseCloseCapacityAssignment({ status: 'cancelled' }), BadRequestException);
});

test('parses an ended assignment without a reason', () => {
  const parsed = parseCloseCapacityAssignment({
    status: 'ended',
    endsAt: '2026-09-02T15:00:00Z',
  });
  assert.equal(parsed.status, 'ended');
  assert.equal(parsed.endsAt, '2026-09-02T15:00:00.000Z');
  assert.equal(parsed.statusReason, null);
});

test('rejects assignment end before start', () => {
  assert.throws(
    () =>
      validateAssignmentPeriod(new Date('2026-09-02T12:00:00Z'), new Date('2026-09-01T12:00:00Z')),
    BadRequestException,
  );
});
