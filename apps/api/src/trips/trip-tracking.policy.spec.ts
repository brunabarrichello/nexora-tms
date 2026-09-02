import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTrackingPolicy } from './trip-tracking.policy.js';

test('tracking policy uses bounded defaults', () => {
  assert.deepEqual(resolveTrackingPolicy(null, {}), {
    staleAfterSeconds: 900,
    retentionDays: 90,
  });
});

test('tracking policy applies provider override', () => {
  assert.deepEqual(
    resolveTrackingPolicy('provider-a', {
      TRACKING_STALE_AFTER_SECONDS: '1200',
      TRACKING_RETENTION_DAYS: '120',
      TRACKING_PROVIDER_POLICIES_JSON: JSON.stringify({
        'provider-a': { staleAfterSeconds: 300, retentionDays: 45 },
      }),
    }),
    { staleAfterSeconds: 300, retentionDays: 45 },
  );
});

test('tracking policy rejects unsafe bounds and invalid JSON', () => {
  assert.throws(
    () => resolveTrackingPolicy(null, { TRACKING_STALE_AFTER_SECONDS: '30' }),
    /between 60 and 86400/,
  );
  assert.throws(
    () => resolveTrackingPolicy('provider-a', { TRACKING_PROVIDER_POLICIES_JSON: '{' }),
    /valid JSON/,
  );
});
