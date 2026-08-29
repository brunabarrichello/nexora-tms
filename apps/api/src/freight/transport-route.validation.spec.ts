import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { parseReplaceTransportRoute } from './transport-route.validation.js';

const pickup = {
  type: 'pickup',
  partyId: '00000000-0000-4000-8000-000000000501',
  addressId: '00000000-0000-4000-8000-000000000701',
  windowStartAt: '2026-09-01T08:00:00.000Z',
  windowEndAt: '2026-09-01T10:00:00.000Z',
  instructions: '  Portaria A  ',
};

const delivery = {
  type: 'delivery',
  partyId: '00000000-0000-4000-8000-000000000503',
  addressId: '00000000-0000-4000-8000-000000000703',
  windowStartAt: '2026-09-02T08:00:00.000Z',
  windowEndAt: '2026-09-02T12:00:00.000Z',
};

test('route validation derives ordered sequence and normalizes instructions', () => {
  const result = parseReplaceTransportRoute({ stops: [pickup, delivery] });
  assert.equal(result[0]!.sequence, 1);
  assert.equal(result[1]!.sequence, 2);
  assert.equal(result[0]!.instructions, 'Portaria A');
  assert.equal(result[1]!.instructions, null);
});

test('route validation accepts intermediate support stops', () => {
  const support = {
    ...pickup,
    type: 'support',
    partyId: '00000000-0000-4000-8000-000000000504',
    addressId: '00000000-0000-4000-8000-000000000704',
    windowStartAt: '2026-09-01T18:00:00.000Z',
    windowEndAt: '2026-09-01T19:00:00.000Z',
  };
  const result = parseReplaceTransportRoute({ stops: [pickup, support, delivery] });
  assert.deepEqual(
    result.map((stop) => stop.type),
    ['pickup', 'support', 'delivery'],
  );
});

test('route validation requires pickup first', () => {
  assert.throws(
    () => parseReplaceTransportRoute({ stops: [{ ...pickup, type: 'support' }, delivery] }),
    BadRequestException,
  );
});

test('route validation requires delivery last', () => {
  assert.throws(
    () => parseReplaceTransportRoute({ stops: [pickup, { ...delivery, type: 'support' }] }),
    BadRequestException,
  );
});

test('route validation rejects inverted stop windows', () => {
  assert.throws(
    () =>
      parseReplaceTransportRoute({
        stops: [
          {
            ...pickup,
            windowStartAt: '2026-09-01T10:00:00.000Z',
            windowEndAt: '2026-09-01T09:00:00.000Z',
          },
          delivery,
        ],
      }),
    BadRequestException,
  );
});

test('route validation rejects temporal order that moves backwards', () => {
  assert.throws(
    () =>
      parseReplaceTransportRoute({
        stops: [
          {
            ...pickup,
            windowStartAt: '2026-09-03T08:00:00.000Z',
            windowEndAt: '2026-09-03T10:00:00.000Z',
          },
          delivery,
        ],
      }),
    BadRequestException,
  );
});
