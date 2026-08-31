import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Reflector } from '@nestjs/core';

import { REQUIRED_TENANT_PERMISSION } from '../tenancy/tenant-permission.guard.js';
import { DocumentsController } from './documents.controller.js';

const reflector = new Reflector();

function expectPermission(target: object, permission: string): void {
  assert.equal(reflector.get(REQUIRED_TENANT_PERMISSION, target), permission);
}

test('Documents controller requires read permission by default', () => {
  expectPermission(DocumentsController, 'documents.read');
});

test('Document write handlers require write permission', () => {
  const handlers = [
    DocumentsController.prototype.create,
    DocumentsController.prototype.update,
    DocumentsController.prototype.prepareUpload,
    DocumentsController.prototype.commitUpload,
    DocumentsController.prototype.validate,
    DocumentsController.prototype.linkBusinessParty,
    DocumentsController.prototype.linkTransportRequest,
    DocumentsController.prototype.linkDriver,
    DocumentsController.prototype.linkAsset,
  ];

  for (const handler of handlers) {
    expectPermission(handler, 'documents.write');
  }
});
