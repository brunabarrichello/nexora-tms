import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCreateCapacityAsset,
  parseUpdateCapacityAsset,
  validateCapacityAssetDimensions,
  validateCapacityAssetOwnership,
  validateCapacityAssetState,
} from './capacity-asset.validation.js';

const carrierPartyId = '00000000-0000-4000-8000-000000000501';

function baseInput(): Record<string, unknown> {
  return {
    carrierPartyId,
    assetKind: 'vehicle',
    identifier: 'TRUCK-001',
    plate: 'ABC1D23',
    vehicleType: 'truck',
    bodyType: 'sider',
    capacityWeightKg: 14000,
    capacityVolumeM3: 85,
    maxLengthM: 14.8,
    maxWidthM: 2.6,
    maxHeightM: 2.9,
    trackingAvailable: true,
    status: 'active',
  };
}

test('normalizes plate, identifier and vehicle/body types', () => {
  const parsed = parseCreateCapacityAsset({
    ...baseInput(),
    identifier: ' truck-001 ',
    plate: 'abc-1d23',
    vehicleType: ' Truck ',
    bodyType: ' Sider ',
  });
  assert.equal(parsed.identifier, 'TRUCK-001');
  assert.equal(parsed.plate, 'ABC1D23');
  assert.equal(parsed.vehicleType, 'truck');
  assert.equal(parsed.bodyType, 'sider');
  assert.equal(parsed.status, 'active');
});

test('accepts legacy Brazilian plate', () => {
  assert.equal(parseCreateCapacityAsset({ ...baseInput(), plate: 'ABC-1234' }).plate, 'ABC1234');
});

test('defaults tracking to false and status to inactive', () => {
  const parsed = parseCreateCapacityAsset({
    ...baseInput(),
    trackingAvailable: undefined,
    status: undefined,
  });
  assert.equal(parsed.trackingAvailable, false);
  assert.equal(parsed.status, 'inactive');
});

test('requires owner or carrier reference', () => {
  assert.throws(() =>
    parseCreateCapacityAsset({
      ...baseInput(),
      carrierPartyId: null,
      ownerPartyId: null,
      ownerName: null,
    }),
  );
});

test('requires all dimensions together', () => {
  assert.throws(() => parseCreateCapacityAsset({ ...baseInput(), maxHeightM: null }));
  assert.throws(() => validateCapacityAssetDimensions(10, null, null));
});

test('requires positive capacities', () => {
  assert.throws(() => parseCreateCapacityAsset({ ...baseInput(), capacityWeightKg: 0 }));
  assert.throws(() => parseCreateCapacityAsset({ ...baseInput(), capacityVolumeM3: -1 }));
});

test('requires reason for blocked status', () => {
  assert.throws(() => parseCreateCapacityAsset({ ...baseInput(), status: 'blocked' }));
  assert.throws(() => validateCapacityAssetState('blocked', null));
});

test('update requires at least one field', () => {
  assert.throws(() => parseUpdateCapacityAsset({}));
  assert.deepEqual(parseUpdateCapacityAsset({ trackingAvailable: true }), {
    trackingAvailable: true,
  });
});

test('validates owner helper', () => {
  assert.doesNotThrow(() => validateCapacityAssetOwnership(null, null, 'Owner Name'));
  assert.throws(() => validateCapacityAssetOwnership(null, null, null));
});
