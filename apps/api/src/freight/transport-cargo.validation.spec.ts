import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { parseTransportCargoProfile } from './transport-cargo.validation.js';

const validProfile = {
  material: 'Eletrônicos gerais',
  cargoType: 'general',
  totalWeightKg: 5000,
  volumeCount: 20,
  palletCount: 4,
  cubageM3: 18.5,
  maxLengthM: 2.4,
  maxWidthM: 1.2,
  maxHeightM: 1.8,
  trackingRequired: true,
  vehicleType: 'carreta',
  bodyType: 'sider',
  nonStackable: true,
  specialCargo: false,
};

test('parses a complete cargo profile', () => {
  const profile = parseTransportCargoProfile(validProfile);
  assert.equal(profile.material, 'Eletrônicos gerais');
  assert.equal(profile.totalWeightKg, 5000);
  assert.equal(profile.volumeCount, 20);
  assert.equal(profile.palletCount, 4);
  assert.equal(profile.trackingRequired, true);
  assert.equal(profile.nonStackable, true);
  assert.equal(profile.specialInstructions, null);
});

test('defaults optional counts and flags while requiring at least one package unit', () => {
  const profile = parseTransportCargoProfile({
    ...validProfile,
    volumeCount: undefined,
    palletCount: 2,
    trackingRequired: undefined,
    nonStackable: undefined,
    specialCargo: undefined,
  });

  assert.equal(profile.volumeCount, 0);
  assert.equal(profile.palletCount, 2);
  assert.equal(profile.trackingRequired, false);
  assert.equal(profile.nonStackable, false);
  assert.equal(profile.specialCargo, false);
});

test('rejects zero weight', () => {
  assert.throws(
    () => parseTransportCargoProfile({ ...validProfile, totalWeightKg: 0 }),
    BadRequestException,
  );
});

test('rejects profiles without volumes or pallets', () => {
  assert.throws(
    () => parseTransportCargoProfile({ ...validProfile, volumeCount: 0, palletCount: 0 }),
    /At least one volume or pallet/,
  );
});

test('requires all three dimensions when any dimension is informed', () => {
  assert.throws(
    () =>
      parseTransportCargoProfile({
        ...validProfile,
        maxWidthM: undefined,
      }),
    /must be informed together/,
  );
});

test('requires instructions for special cargo', () => {
  assert.throws(
    () =>
      parseTransportCargoProfile({
        ...validProfile,
        specialCargo: true,
        specialInstructions: '   ',
      }),
    /specialInstructions is required/,
  );
});
