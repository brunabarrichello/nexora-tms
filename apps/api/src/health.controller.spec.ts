import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { HealthController } from './health.controller.js';
import type { TenantDatabaseService } from './tenancy/tenant-database.service.js';

function healthController(checkReadiness: () => Promise<void>): HealthController {
  return new HealthController({ checkReadiness } as TenantDatabaseService);
}

test('health and liveness endpoints report the API as alive', () => {
  const controller = healthController(async () => undefined);
  const health = controller.getHealth();
  const liveness = controller.getLiveness();

  for (const response of [health, liveness]) {
    assert.equal(response.status, 'ok');
    assert.equal(response.service, 'nexora-tms-api');
    assert.doesNotThrow(() => new Date(response.timestamp).toISOString());
  }
});

test('readiness succeeds only after the database probe succeeds', async () => {
  let checked = false;
  const controller = healthController(async () => {
    checked = true;
  });

  const readiness = await controller.getReadiness();
  assert.equal(checked, true);
  assert.equal(readiness.status, 'ok');
  assert.equal(readiness.database, 'ok');
});

test('readiness fails closed without leaking database errors', async () => {
  const controller = healthController(async () => {
    throw new Error('sensitive database detail');
  });

  await assert.rejects(controller.getReadiness(), (error: unknown) => {
    assert.ok(error instanceof ServiceUnavailableException);
    assert.equal(error.message, 'database readiness check failed');
    assert.equal(error.message.includes('sensitive'), false);
    return true;
  });
});

test('application module initializes with runtime dependencies resolvable', async () => {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });

  try {
    await app.init();
    assert.ok(app);
  } finally {
    await app.close();
  }
});
