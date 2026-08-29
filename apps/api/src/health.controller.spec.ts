import assert from 'node:assert/strict';
import test from 'node:test';

import { HealthController } from './health.controller';

test('health endpoint reports the API as healthy', () => {
  const health = new HealthController().getHealth();

  assert.equal(health.status, 'ok');
  assert.equal(health.service, 'nexora-tms-api');
  assert.doesNotThrow(() => new Date(health.timestamp).toISOString());
});
