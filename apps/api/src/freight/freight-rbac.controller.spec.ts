import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { FreightNormalizationController } from './freight-normalization.controller.js';
import { TransportCommercialController } from './transport-commercial.controller.js';
import { TransportRequestController } from './transport-request.controller.js';
import { TransportRouteController } from './transport-route.controller.js';

const reflector = new Reflector();

function assertPermission(method: (...args: never[]) => unknown, permission: string): void {
  assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, method), permission);
}

test('Transport Request routes enforce freight read/write permissions', () => {
  assertPermission(TransportRequestController.prototype.list, 'freight.read');
  assertPermission(TransportRequestController.prototype.getById, 'freight.read');
  assertPermission(TransportRequestController.prototype.create, 'freight.write');
  assertPermission(TransportRequestController.prototype.update, 'freight.write');
});

test('Transport Route routes enforce freight read/write permissions', () => {
  assertPermission(TransportRouteController.prototype.getRoute, 'freight.read');
  assertPermission(TransportRouteController.prototype.replaceRoute, 'freight.write');
});

test('Commercial Terms routes enforce freight read/write permissions', () => {
  assertPermission(TransportCommercialController.prototype.getTerms, 'freight.read');
  assertPermission(TransportCommercialController.prototype.getHistory, 'freight.read');
  assertPermission(TransportCommercialController.prototype.upsertTerms, 'freight.write');
  assertPermission(TransportCommercialController.prototype.changeStatus, 'freight.write');
});

test('Freight normalization read routes require freight.read', () => {
  const methods = [
    FreightNormalizationController.prototype.listItems,
    FreightNormalizationController.prototype.listPackages,
    FreightNormalizationController.prototype.listRequirements,
    FreightNormalizationController.prototype.listReferences,
    FreightNormalizationController.prototype.listStatusHistory,
    FreightNormalizationController.prototype.listEvents,
    FreightNormalizationController.prototype.listLanes,
  ];

  for (const method of methods) {
    assertPermission(method, 'freight.read');
  }
});

test('Freight normalization mutation routes require freight.write', () => {
  const methods = [
    FreightNormalizationController.prototype.createItem,
    FreightNormalizationController.prototype.updateItem,
    FreightNormalizationController.prototype.deleteItem,
    FreightNormalizationController.prototype.createPackage,
    FreightNormalizationController.prototype.updatePackage,
    FreightNormalizationController.prototype.deletePackage,
    FreightNormalizationController.prototype.createRequirement,
    FreightNormalizationController.prototype.updateRequirement,
    FreightNormalizationController.prototype.deleteRequirement,
    FreightNormalizationController.prototype.createReference,
    FreightNormalizationController.prototype.updateReference,
    FreightNormalizationController.prototype.deleteReference,
    FreightNormalizationController.prototype.createEvent,
    FreightNormalizationController.prototype.createLane,
    FreightNormalizationController.prototype.updateLane,
  ];

  for (const method of methods) {
    assertPermission(method, 'freight.write');
  }
});
