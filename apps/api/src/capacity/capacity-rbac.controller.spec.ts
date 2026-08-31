import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { CapacityAssetController } from './capacity-asset.controller.js';
import { CapacityAssignmentController } from './capacity-assignment.controller.js';
import { CapacityQualificationController } from './capacity-qualification.controller.js';
import { DriverController } from './driver.controller.js';

const reflector = new Reflector();

function assertHandlerPermission(method: (...args: never[]) => unknown, permission: string): void {
  assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, method), permission);
}

test('Capacity controllers default to capacity.read', () => {
  assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, CapacityAssetController), 'capacity.read');
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, CapacityAssignmentController),
    'capacity.read',
  );
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, CapacityQualificationController),
    'capacity.read',
  );
  assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, DriverController), 'capacity.read');
});

test('Capacity asset, assignment and driver mutations require capacity.write', () => {
  const methods = [
    CapacityAssetController.prototype.create,
    CapacityAssetController.prototype.update,
    CapacityAssignmentController.prototype.create,
    CapacityAssignmentController.prototype.close,
    DriverController.prototype.create,
    DriverController.prototype.update,
  ];

  for (const method of methods) {
    assertHandlerPermission(method, 'capacity.write');
  }
});

test('Capacity qualification mutations require capacity.write', () => {
  const methods = [
    CapacityQualificationController.prototype.createDriverDocument,
    CapacityQualificationController.prototype.createDriverQualification,
    CapacityQualificationController.prototype.createDriverCourse,
    CapacityQualificationController.prototype.setDriverAvailability,
    CapacityQualificationController.prototype.createDriverUnavailability,
    CapacityQualificationController.prototype.createDriverEmergencyContact,
    CapacityQualificationController.prototype.createDriverBlock,
    CapacityQualificationController.prototype.releaseDriverBlock,
    CapacityQualificationController.prototype.createDriverRating,
    CapacityQualificationController.prototype.setAssetCapabilities,
    CapacityQualificationController.prototype.createAssetDocument,
    CapacityQualificationController.prototype.createMaintenancePlan,
    CapacityQualificationController.prototype.createMaintenance,
    CapacityQualificationController.prototype.createMaintenanceItem,
    CapacityQualificationController.prototype.createInsurance,
    CapacityQualificationController.prototype.createInspection,
    CapacityQualificationController.prototype.setAssetAvailability,
    CapacityQualificationController.prototype.createAssetUnavailability,
    CapacityQualificationController.prototype.createAssetLocation,
    CapacityQualificationController.prototype.createAssetBlock,
    CapacityQualificationController.prototype.releaseAssetBlock,
  ];

  for (const method of methods) {
    assertHandlerPermission(method, 'capacity.write');
  }
});
