import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  generateIntegrationCredential,
  hashIntegrationSecret,
  parseIntegrationAuthorization,
} from './integration-auth.service.js';

const clientId = '88000000-0000-4000-8000-000000000001';

test('integration credential is one-time bearer material with SHA-256 storage hash', () => {
  const generated = generateIntegrationCredential(clientId);
  assert.match(generated.apiKey, new RegExp(`^nxint_${clientId}\\.[A-Za-z0-9_-]{32,128}$`));
  assert.match(generated.secretHashHex, /^[0-9a-f]{64}$/);
  const parsed = parseIntegrationAuthorization(`Bearer ${generated.apiKey}`);
  assert.equal(parsed.clientId, clientId);
  assert.equal(hashIntegrationSecret(parsed.secret), generated.secretHashHex);
  assert.equal(generated.apiKey.includes(generated.secretHashHex), false);
});

test('integration authorization rejects arbitrary bearer values', () => {
  assert.throws(() => parseIntegrationAuthorization('Bearer user-token'), /Invalid integration credential/);
  assert.throws(() => parseIntegrationAuthorization(undefined), /required/);
});
