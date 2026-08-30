import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  parseAssetCapabilities,
  parseAssetLocation,
  parseAvailability,
  parseBlock,
  parseCourse,
  parseDocumentRegister,
  parseInspection,
  parseInsurance,
  parseMaintenance,
  parseMaintenancePlan,
  parseRating,
  parseUnavailability,
  requireUuid,
} from './capacity-qualification.validation.js';

const uuid = '00000000-0000-4000-8000-000000000001';

test('accepts valid driver availability and normalizes datetimes', () => {
  const value = parseAvailability({
    status: 'available',
    availableFrom: '2026-09-01T06:00:00-03:00',
    availableUntil: '2026-09-01T18:00:00-03:00',
    currentCityId: uuid,
    maxDistanceKm: 750,
  });
  assert.equal(value.status, 'available');
  assert.equal(value.availableFrom, '2026-09-01T09:00:00.000Z');
  assert.equal(value.maxDistanceKm, 750);
});

test('rejects inverted availability windows', () => {
  assert.throws(
    () => parseAvailability({ status: 'available', availableFrom: '2026-09-02T10:00:00Z', availableUntil: '2026-09-01T10:00:00Z' }),
    BadRequestException,
  );
});

test('rejects document expiry before issue date', () => {
  assert.throws(
    () => parseDocumentRegister({ documentTypeId: uuid, issuedOn: '2026-09-02', expiresOn: '2026-09-01' }),
    BadRequestException,
  );
});

test('accepts courses and enforces positive workload', () => {
  assert.equal(
    parseCourse({ courseCode: 'MOPP', courseName: 'MOPP', completedOn: '2026-08-30', workloadHours: 50 }).workloadHours,
    50,
  );
  assert.throws(
    () => parseCourse({ courseCode: 'MOPP', courseName: 'MOPP', completedOn: '2026-08-30', workloadHours: 0 }),
    BadRequestException,
  );
});

test('unavailability requires endsAt after startsAt', () => {
  assert.throws(
    () => parseUnavailability({ reasonCode: 'REST', reason: 'Rest', startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T10:00:00Z' }),
    BadRequestException,
  );
});

test('driver and asset blocks enforce allowed severities', () => {
  assert.equal(parseBlock({ reasonCode: 'DOC', reason: 'Review', severity: 'compliance' }).severity, 'compliance');
  assert.equal(parseBlock({ reasonCode: 'MAINT', reason: 'Workshop', severity: 'maintenance' }, true).severity, 'maintenance');
  assert.throws(() => parseBlock({ reasonCode: 'MAINT', reason: 'Workshop', severity: 'maintenance' }), BadRequestException);
});

test('ratings are constrained to zero through five', () => {
  assert.equal(parseRating({ dimension: 'punctuality', score: 4.75 }).score, 4.75);
  assert.throws(() => parseRating({ dimension: 'punctuality', score: 5.1 }), BadRequestException);
});

test('asset capability temperatures must be coherent', () => {
  const value = parseAssetCapabilities({ trackingCapable: true, maxPallets: 28, minTemperatureC: -20, maxTemperatureC: 5 });
  assert.equal(value.trackingCapable, true);
  assert.equal(value.maxPallets, 28);
  assert.throws(() => parseAssetCapabilities({ minTemperatureC: 10, maxTemperatureC: 5 }), BadRequestException);
});

test('maintenance plan requires a positive time or odometer interval', () => {
  assert.equal(parseMaintenancePlan({ name: 'Preventive', maintenanceType: 'preventive', intervalDays: 90 }).intervalDays, 90);
  assert.throws(() => parseMaintenancePlan({ name: 'Invalid', maintenanceType: 'preventive' }), BadRequestException);
});

test('maintenance monetary cost requires currency', () => {
  assert.throws(
    () => parseMaintenance({ maintenanceType: 'preventive', totalCost: 100 }),
    BadRequestException,
  );
  assert.equal(parseMaintenance({ maintenanceType: 'preventive', totalCost: 100, currencyId: uuid }).totalCost, 100);
});

test('insurance dates and currency are validated', () => {
  assert.throws(
    () => parseInsurance({ policyNumber: 'P1', startsOn: '2026-09-02', endsOn: '2026-09-01' }),
    BadRequestException,
  );
  assert.throws(
    () => parseInsurance({ policyNumber: 'P1', startsOn: '2026-09-01', endsOn: '2027-09-01', coverageAmount: 1000 }),
    BadRequestException,
  );
});

test('inspection checklist must be an object', () => {
  assert.deepEqual(
    parseInspection({ inspectionType: 'pre_trip', performedAt: '2026-09-01T10:00:00Z', result: 'passed', checklist: { tires: true } }).checklist,
    { tires: true },
  );
  assert.throws(
    () => parseInspection({ inspectionType: 'pre_trip', performedAt: '2026-09-01T10:00:00Z', result: 'passed', checklist: [] }),
    BadRequestException,
  );
});

test('asset position validates geographic bounds and source', () => {
  assert.equal(parseAssetLocation({ observedAt: '2026-09-01T10:00:00Z', latitude: -23.55, longitude: -46.63, source: 'gps' }).source, 'gps');
  assert.throws(
    () => parseAssetLocation({ observedAt: '2026-09-01T10:00:00Z', latitude: 91, longitude: 0, source: 'gps' }),
    BadRequestException,
  );
  assert.throws(
    () => parseAssetLocation({ observedAt: '2026-09-01T10:00:00Z', latitude: 0, longitude: 0, source: 'unknown' }),
    BadRequestException,
  );
});

test('UUID guard rejects malformed identifiers', () => {
  assert.equal(requireUuid(uuid), uuid);
  assert.throws(() => requireUuid('not-a-uuid'), BadRequestException);
});
