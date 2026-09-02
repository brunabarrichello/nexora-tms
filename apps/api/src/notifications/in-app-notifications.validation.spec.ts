import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { TenantContext } from '../tenancy/tenant-context.js';
import type { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { InAppNotificationsService } from './in-app-notifications.service.js';

const service = new InAppNotificationsService({} as TenantContext, {} as TenantDatabaseService);

test('notification list rejects unsupported state before database access', async () => {
  await assert.rejects(service.list({ state: 'archived' }), /state must be one of/);
});

test('notification list rejects unsupported module before database access', async () => {
  await assert.rejects(service.list({ module: 'finance' }), /module must be one of/);
});

test('notification list rejects unsafe limits before database access', async () => {
  await assert.rejects(service.list({ limit: '0' }), /limit must be an integer/);
  await assert.rejects(service.list({ limit: '201' }), /limit must be an integer/);
});

test('mark read rejects malformed notification ids before database access', async () => {
  await assert.rejects(service.markRead('not-a-uuid'), /notificationId must be a valid UUID/);
});
