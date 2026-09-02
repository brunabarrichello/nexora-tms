import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { TENANT_PERMISSIONS } from '../tenancy/rbac-catalog.js';
import { ExternalApiController } from './external-api.controller.js';
import { REQUIRED_INTEGRATION_SCOPES } from './integration-scope.guard.js';
import { IntegrationsController } from './integrations.controller.js';

const reflector = new Reflector();

test('integration administration reads require audit.read', () => {
  assert.equal(
    reflector.get(REQUIRED_TENANT_PERMISSION, IntegrationsController),
    TENANT_PERMISSIONS.AUDIT_READ,
  );
});

test('integration client and webhook mutations require tenant.manage', () => {
  for (const method of [
    IntegrationsController.prototype.createClient,
    IntegrationsController.prototype.revokeClient,
    IntegrationsController.prototype.createWebhook,
    IntegrationsController.prototype.updateWebhook,
  ]) {
    assert.equal(
      reflector.get(REQUIRED_TENANT_PERMISSION, method),
      TENANT_PERMISSIONS.TENANT_MANAGE,
    );
  }
});

test('external API routes declare explicit least-privilege scopes', () => {
  assert.deepEqual(
    reflector.get(
      REQUIRED_INTEGRATION_SCOPES,
      ExternalApiController.prototype.listTransportRequests,
    ),
    ['freight.read'],
  );
  assert.deepEqual(
    reflector.get(REQUIRED_INTEGRATION_SCOPES, ExternalApiController.prototype.getTransportRequest),
    ['freight.read'],
  );
  assert.deepEqual(
    reflector.get(REQUIRED_INTEGRATION_SCOPES, ExternalApiController.prototype.listTrips),
    ['trips.read'],
  );
  assert.deepEqual(
    reflector.get(REQUIRED_INTEGRATION_SCOPES, ExternalApiController.prototype.getTrip),
    ['trips.read'],
  );
  assert.deepEqual(
    reflector.get(REQUIRED_INTEGRATION_SCOPES, ExternalApiController.prototype.listDocuments),
    ['documents.read'],
  );
  assert.deepEqual(
    reflector.get(REQUIRED_INTEGRATION_SCOPES, ExternalApiController.prototype.getDocument),
    ['documents.read'],
  );
});
