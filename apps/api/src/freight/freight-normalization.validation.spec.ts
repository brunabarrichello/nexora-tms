import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  parseEventCreate,
  parseItemCreate,
  parseLaneCreate,
  parsePackageCreate,
  parseReferenceCreate,
  parseRequirementCreate,
} from './freight-normalization.validation.js';

const uuid1 = '00000000-0000-4000-8000-000000000001';
const uuid2 = '00000000-0000-4000-8000-000000000002';

test('normalizes cargo item defaults and validates temperature range', () => {
  const item = parseItemCreate({ sequence: 1, description: 'Pallets' });
  assert.equal(item.quantity, 1);
  assert.equal(item.hazardous, false);
  assert.throws(
    () =>
      parseItemCreate({
        sequence: 1,
        description: 'Refrigerated',
        minTemperatureC: 10,
        maxTemperatureC: 2,
      }),
    BadRequestException,
  );
});

test('packages require dimensions together and positive quantity', () => {
  assert.throws(
    () => parsePackageCreate({ sequence: 1, quantity: 1, lengthM: 1 }),
    BadRequestException,
  );
  assert.equal(
    parsePackageCreate({ sequence: 1, quantity: 2, lengthM: 1, widthM: 2, heightM: 3 })
      .quantity,
    2,
  );
});

test('tracking requirement requires a boolean value', () => {
  assert.throws(
    () =>
      parseRequirementCreate({
        code: 'TRACKING',
        requirementType: 'tracking',
      }),
    BadRequestException,
  );
  assert.equal(
    parseRequirementCreate({
      code: 'tracking',
      requirementType: 'tracking',
      valueBoolean: true,
    }).code,
    'TRACKING',
  );
});

test('vehicle requirements require a vehicle type reference', () => {
  assert.throws(
    () => parseRequirementCreate({ code: 'VEHICLE', requirementType: 'vehicle_type' }),
    BadRequestException,
  );
  assert.equal(
    parseRequirementCreate({
      code: 'VEHICLE',
      requirementType: 'vehicle_type',
      vehicleTypeId: uuid1,
    }).vehicleTypeId,
    uuid1,
  );
});

test('references enforce the Wave 0019 type whitelist', () => {
  assert.equal(
    parseReferenceCreate({ referenceType: 'customer_order', value: 'PO-123' }).value,
    'PO-123',
  );
  assert.throws(
    () => parseReferenceCreate({ referenceType: 'unknown', value: 'x' }),
    BadRequestException,
  );
});

test('freight lane requires distinct cities and positive metrics', () => {
  assert.throws(
    () =>
      parseLaneCreate({
        code: 'SP-SP',
        name: 'Invalid',
        originCityId: uuid1,
        destinationCityId: uuid1,
      }),
    BadRequestException,
  );
  const lane = parseLaneCreate({
    code: 'sp-curitiba',
    name: 'São Paulo → Curitiba',
    originCityId: uuid1,
    destinationCityId: uuid2,
    distanceKm: 408,
    typicalTransitHours: 7,
  });
  assert.equal(lane.code, 'SP-CURITIBA');
});

test('user freight events accept structured payload and validate correlation UUID', () => {
  const event = parseEventCreate({
    eventType: 'customer_note',
    correlationId: uuid1,
    payload: { note: 'Coleta confirmada' },
  });
  assert.equal(event.eventType, 'customer_note');
  assert.deepEqual(event.payload, { note: 'Coleta confirmada' });
  assert.throws(
    () => parseEventCreate({ eventType: 'note', correlationId: 'invalid' }),
    BadRequestException,
  );
});
