import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  parseCreateIntegrationClient,
  parseCreateWebhookSubscription,
} from './integrations.validation.js';

const integrationClientId = '88000000-0000-4000-8000-000000000001';

test('external integration scopes are explicit and bounded', () => {
  assert.deepEqual(
    parseCreateIntegrationClient({
      name: 'ERP principal',
      scopes: ['freight.read', 'trips.read'],
    }),
    {
      name: 'ERP principal',
      scopes: ['freight.read', 'trips.read'],
      expiresAt: null,
    },
  );
  assert.throws(
    () => parseCreateIntegrationClient({ name: 'ERP', scopes: ['finance.write'] }),
    /scope must be one of/,
  );
});

test('webhook validation requires public HTTPS endpoints', () => {
  const parsed = parseCreateWebhookSubscription({
    integrationClientId,
    name: 'ERP webhook',
    endpointUrl: 'https://hooks.example.com/nexora',
    eventTypes: ['freight.transport_request.created'],
  });
  assert.equal(parsed.endpointUrl, 'https://hooks.example.com/nexora');
  assert.equal(parsed.maxAttempts, 5);
  assert.equal(parsed.timeoutMs, 5000);

  for (const endpointUrl of [
    'http://hooks.example.com/nexora',
    'https://127.0.0.1/hook',
    'https://10.0.0.4/hook',
    'https://192.168.1.10/hook',
    'https://localhost/hook',
  ]) {
    assert.throws(
      () =>
        parseCreateWebhookSubscription({
          integrationClientId,
          name: 'unsafe',
          endpointUrl,
          eventTypes: ['freight.transport_request.created'],
        }),
      /endpointUrl/,
    );
  }
});
