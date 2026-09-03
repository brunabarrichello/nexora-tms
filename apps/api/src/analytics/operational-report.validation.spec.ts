import assert from 'node:assert/strict';
import test from 'node:test';

import { parseOperationalReportQuery } from './operational-report.service.js';

test('operational report parses filters and pagination', () => {
  const parsed = parseOperationalReportQuery({
    from: '2026-09-01T00:00:00.000Z',
    to: '2026-09-03T00:00:00.000Z',
    customerPartyId: '76000000-0000-4000-8000-000000000502',
    origin: 'Sorocaba',
    destination: 'Santos',
    status: 'contracted',
    page: '2',
    pageSize: '50',
  });

  assert.equal(parsed.from.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(parsed.to.toISOString(), '2026-09-03T00:00:00.000Z');
  assert.equal(parsed.customerPartyId, '76000000-0000-4000-8000-000000000502');
  assert.equal(parsed.origin, 'Sorocaba');
  assert.equal(parsed.destination, 'Santos');
  assert.equal(parsed.status, 'contracted');
  assert.equal(parsed.page, 2);
  assert.equal(parsed.pageSize, 50);
});

test('operational report rejects invalid customer', () => {
  assert.throws(
    () => parseOperationalReportQuery({ customerPartyId: 'invalid' }),
    /customerPartyId must be a valid UUID/,
  );
});

test('operational report rejects invalid status', () => {
  assert.throws(
    () => parseOperationalReportQuery({ status: 'unknown' }),
    /status must be one of/,
  );
});

test('operational report rejects periods longer than 366 days', () => {
  assert.throws(
    () =>
      parseOperationalReportQuery({
        from: '2025-01-01T00:00:00.000Z',
        to: '2026-09-01T00:00:00.000Z',
      }),
    /report period cannot exceed 366 days/,
  );
});
