import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { TripExecutionController } from './trip-execution.controller.js';
import { TripOccurrenceController } from './trip-occurrence.controller.js';
import { TripsController } from './trips.controller.js';

const reflector = new Reflector();

function expectHandlerPermission(handler: (...args: never[]) => unknown, permission: string): void {
  assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, handler), permission);
}

test('Trips controllers require trips.read by default', () => {
  assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, TripsController), 'trips.read');
  assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, TripExecutionController), 'trips.read');
  assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, TripOccurrenceController), 'trips.read');
});

test('Trips Core mutations require trips.write', () => {
  const handlers = [
    TripsController.prototype.create,
    TripsController.prototype.setStatus,
    TripsController.prototype.addRequest,
    TripsController.prototype.removeRequest,
    TripsController.prototype.addStop,
    TripsController.prototype.addDriver,
    TripsController.prototype.addAsset,
  ];

  for (const handler of handlers) {
    expectHandlerPermission(handler, 'trips.write');
  }
});

test('Trips Execution mutations require trips.write', () => {
  const handlers = [
    TripExecutionController.prototype.createEvent,
    TripExecutionController.prototype.createCheckin,
    TripExecutionController.prototype.createLocation,
    TripExecutionController.prototype.createChecklist,
    TripExecutionController.prototype.setChecklistStatus,
    TripExecutionController.prototype.linkDocument,
    TripExecutionController.prototype.createExpense,
    TripExecutionController.prototype.setExpenseStatus,
    TripExecutionController.prototype.createToll,
    TripExecutionController.prototype.createFuel,
    TripExecutionController.prototype.createProof,
    TripExecutionController.prototype.createDeliveryProof,
  ];

  for (const handler of handlers) {
    expectHandlerPermission(handler, 'trips.write');
  }
});

test('Trip occurrence mutations require trips.write', () => {
  const handlers = [
    TripOccurrenceController.prototype.create,
    TripOccurrenceController.prototype.addTreatment,
    TripOccurrenceController.prototype.setStatus,
    TripOccurrenceController.prototype.linkDocument,
  ];

  for (const handler of handlers) {
    expectHandlerPermission(handler, 'trips.write');
  }
});
