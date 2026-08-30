import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCapacityReservationCancel } from './capacity-reservation.validation.js';

test('normalizes a capacity reservation cancellation reason', () => {
  assert.deepEqual(parseCapacityReservationCancel({ reason: '  Vehicle unavailable  ' }), {
    reason: 'Vehicle unavailable',
  });
});

test('requires a cancellation reason', () => {
  assert.throws(() => parseCapacityReservationCancel({ reason: '   ' }), /reason is required/);
});

test('rejects non-object cancellation payloads', () => {
  assert.throws(() => parseCapacityReservationCancel(null), /Request body must be an object/);
});

test('limits cancellation reason length', () => {
  assert.throws(
    () => parseCapacityReservationCancel({ reason: 'x'.repeat(1001) }),
    /reason must be at most 1000 characters/,
  );
});
