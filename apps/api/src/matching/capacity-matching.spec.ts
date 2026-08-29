import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateCapacityCompatibility,
  type CapacityCandidateState,
  type CargoMatchingRequirements,
} from './capacity-matching.js';

const cargo: CargoMatchingRequirements = {
  totalWeightKg: 5000,
  cubageM3: 18.5,
  maxLengthM: 2.4,
  maxWidthM: 1.2,
  maxHeightM: 1.8,
  trackingRequired: true,
  vehicleType: 'carreta',
  bodyType: 'sider',
};

const candidate: CapacityCandidateState = {
  driverRegistrationStatus: 'qualified',
  driverOperationalStatus: 'active',
  vehicleStatus: 'active',
  vehicleType: 'Carreta',
  bodyType: 'SIDER',
  capacityWeightKg: 14000,
  capacityVolumeM3: 85,
  maxLengthM: 14.8,
  maxWidthM: 2.6,
  maxHeightM: 2.9,
  trackingAvailable: true,
};

test('accepts a fully compatible active composition', () => {
  const result = evaluateCapacityCompatibility(cargo, candidate);
  assert.equal(result.compatible, true);
  assert.deepEqual(result.reasons, []);
});

test('explains vehicle, body, weight and tracking incompatibilities', () => {
  const result = evaluateCapacityCompatibility(cargo, {
    ...candidate,
    vehicleType: 'toco',
    bodyType: 'bau',
    capacityWeightKg: 4000,
    trackingAvailable: false,
  });
  assert.equal(result.compatible, false);
  assert.deepEqual(
    result.reasons.map((reason) => reason.code),
    [
      'vehicle_type_mismatch',
      'body_type_mismatch',
      'weight_capacity_insufficient',
      'tracking_unavailable',
    ],
  );
});

test('excludes blocked and inactive records with explicit reasons', () => {
  const result = evaluateCapacityCompatibility(cargo, {
    ...candidate,
    driverRegistrationStatus: 'blocked',
    driverOperationalStatus: 'inactive',
    vehicleStatus: 'blocked',
  });
  assert.equal(result.compatible, false);
  assert.deepEqual(
    result.reasons.map((reason) => reason.code),
    ['driver_not_qualified', 'driver_not_active', 'vehicle_not_active'],
  );
});

test('reports unknown dimensional and volume capacity when cargo requires it', () => {
  const result = evaluateCapacityCompatibility(cargo, {
    ...candidate,
    capacityVolumeM3: null,
    maxLengthM: null,
    maxWidthM: null,
    maxHeightM: null,
  });
  assert.equal(result.compatible, false);
  assert.deepEqual(
    result.reasons.map((reason) => reason.code),
    ['volume_capacity_unknown', 'dimensions_capacity_unknown'],
  );
});

test('reports individual insufficient dimensions', () => {
  const result = evaluateCapacityCompatibility(cargo, {
    ...candidate,
    maxLengthM: 2,
    maxWidthM: 1,
    maxHeightM: 1.5,
  });
  assert.equal(result.compatible, false);
  assert.deepEqual(
    result.reasons.map((reason) => reason.code),
    [
      'length_capacity_insufficient',
      'width_capacity_insufficient',
      'height_capacity_insufficient',
    ],
  );
});
