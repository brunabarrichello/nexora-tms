import assert from 'node:assert/strict';
import test from 'node:test';

import { parseFinancialAnalyticsQuery } from './financial-analytics.service.js';

test('financial analytics parses period and customer filter', () => {
  const parsed = parseFinancialAnalyticsQuery({
    from: '2026-09-01T00:00:00.000Z',
    to: '2026-10-01T00:00:00.000Z',
    customerPartyId: '76000000-0000-4000-8000-000000000502',
  });

  assert.equal(parsed.from.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(parsed.to.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(parsed.customerPartyId, '76000000-0000-4000-8000-000000000502');
});

test('financial analytics rejects invalid customer filter', () => {
  assert.throws(
    () => parseFinancialAnalyticsQuery({ customerPartyId: 'invalid' }),
    /customerPartyId must be a valid UUID/,
  );
});

test('financial analytics rejects periods longer than 366 days', () => {
  assert.throws(
    () =>
      parseFinancialAnalyticsQuery({
        from: '2025-01-01T00:00:00.000Z',
        to: '2026-09-01T00:00:00.000Z',
      }),
    /analytics period cannot exceed 366 days/,
  );
});
