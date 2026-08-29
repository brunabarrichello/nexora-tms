import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  parseCreateTransportRequest,
  parseUpdateTransportRequest,
} from './transport-request.validation.js';

const baseRequest = {
  customerPartyId: '00000000-0000-4000-8000-000000000501',
  shipperPartyId: '00000000-0000-4000-8000-000000000502',
  consigneePartyId: '00000000-0000-4000-8000-000000000503',
  originAddressId: '00000000-0000-4000-8000-000000000601',
  destinationAddressId: '00000000-0000-4000-8000-000000000602',
  plannedPickupAt: '2026-09-01T12:00:00.000Z',
  plannedDeliveryAt: '2026-09-02T12:00:00.000Z',
  cargoDescription: '  Eletrônicos gerais  ',
};

test('transport request creation defaults to draft and normalizes cargo description', () => {
  const result = parseCreateTransportRequest(baseRequest);
  assert.equal(result.status, 'draft');
  assert.equal(result.cargoDescription, 'Eletrônicos gerais');
  assert.equal(result.plannedPickupAt.toISOString(), '2026-09-01T12:00:00.000Z');
});

test('transport request may be created ready for quote', () => {
  const result = parseCreateTransportRequest({ ...baseRequest, status: 'ready_for_quote' });
  assert.equal(result.status, 'ready_for_quote');
});

test('transport request rejects an inverted planned window', () => {
  assert.throws(
    () =>
      parseCreateTransportRequest({
        ...baseRequest,
        plannedPickupAt: '2026-09-03T12:00:00.000Z',
        plannedDeliveryAt: '2026-09-02T12:00:00.000Z',
      }),
    BadRequestException,
  );
});

test('transport request rejects equal origin and destination address', () => {
  assert.throws(
    () =>
      parseCreateTransportRequest({
        ...baseRequest,
        destinationAddressId: baseRequest.originAddressId,
      }),
    BadRequestException,
  );
});

test('transport request update allows controlled draft-ready transition', () => {
  assert.deepEqual(parseUpdateTransportRequest({ status: 'ready_for_quote' }), {
    status: 'ready_for_quote',
  });
});

test('transport request update rejects lifecycle states reserved for later modules', () => {
  assert.throws(() => parseUpdateTransportRequest({ status: 'contracted' }), BadRequestException);
});

test('transport request update rejects empty patches', () => {
  assert.throws(() => parseUpdateTransportRequest({}), BadRequestException);
});
