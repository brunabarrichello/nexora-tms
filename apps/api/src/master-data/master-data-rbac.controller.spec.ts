import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { BusinessPartyDirectoryController } from './business-party-directory.controller.js';
import { BusinessPartyController } from './business-party.controller.js';
import { MasterDataEnrichmentController } from './master-data-enrichment.controller.js';
import { ReferenceDataController } from './reference-data.controller.js';

const reflector = new Reflector();

function expectHandlerPermission(handler: (...args: never[]) => unknown, permission: string): void {
  assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, handler), permission);
}

test('Master Data controllers require read permission by default', () => {
  const controllers = [
    BusinessPartyDirectoryController,
    BusinessPartyController,
    MasterDataEnrichmentController,
    ReferenceDataController,
  ];

  for (const controller of controllers) {
    assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, controller), 'master-data.read');
  }
});

test('Master Data mutation handlers require write permission', () => {
  const handlers = [
    BusinessPartyDirectoryController.prototype.createAddress,
    BusinessPartyDirectoryController.prototype.updateAddress,
    BusinessPartyDirectoryController.prototype.createContact,
    BusinessPartyDirectoryController.prototype.updateContact,
    BusinessPartyController.prototype.create,
    BusinessPartyController.prototype.update,
    MasterDataEnrichmentController.prototype.createLocation,
    MasterDataEnrichmentController.prototype.setLocationLifecycle,
    MasterDataEnrichmentController.prototype.createDimension,
    MasterDataEnrichmentController.prototype.createCommodity,
    MasterDataEnrichmentController.prototype.createPartyGroup,
    MasterDataEnrichmentController.prototype.setPartyGroupMembership,
    MasterDataEnrichmentController.prototype.createPartyRequirement,
    MasterDataEnrichmentController.prototype.createCustomFieldDefinition,
    MasterDataEnrichmentController.prototype.setCustomFieldValue,
    MasterDataEnrichmentController.prototype.setTag,
    MasterDataEnrichmentController.prototype.allocateSequence,
    MasterDataEnrichmentController.prototype.upsertTenantConfiguration,
    ReferenceDataController.prototype.create,
    ReferenceDataController.prototype.update,
  ];

  for (const handler of handlers) {
    expectHandlerPermission(handler, 'master-data.write');
  }
});
