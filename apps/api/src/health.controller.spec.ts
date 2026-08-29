import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { HealthController } from './health.controller.js';

test('health endpoint reports the API as healthy', () => {
  const health = new HealthController().getHealth();

  assert.equal(health.status, 'ok');
  assert.equal(health.service, 'nexora-tms-api');
  assert.doesNotThrow(() => new Date(health.timestamp).toISOString());
});

test('application module initializes with runtime dependencies resolvable', async () => {
  const app = await NestFactory.create(AppModule, { logger: false });

  try {
    await app.init();
    assert.ok(app);
  } finally {
    await app.close();
  }
});
