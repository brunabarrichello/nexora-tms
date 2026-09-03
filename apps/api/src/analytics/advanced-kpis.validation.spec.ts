import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { describe, it } from 'node:test';
import { parseAdvancedKpisQuery } from './advanced-kpis.service.js';

describe('parseAdvancedKpisQuery', () => {
  it('defaults to the last 30 days and a preceding comparison period', () => {
    const result = parseAdvancedKpisQuery({});
    assert.equal(result.to.getTime() - result.from.getTime(), 30 * 86_400_000);
    assert.equal(result.comparisonTo.getTime(), result.from.getTime());
    assert.equal(
      result.comparisonTo.getTime() - result.comparisonFrom.getTime(),
      30 * 86_400_000,
    );
  });

  it('rejects an inverted period', () => {
    assert.throws(
      () => parseAdvancedKpisQuery({ from: '2026-09-03', to: '2026-09-01' }),
      BadRequestException,
    );
  });

  it('rejects an oversized period', () => {
    assert.throws(
      () => parseAdvancedKpisQuery({ from: '2025-01-01', to: '2026-09-03' }),
      BadRequestException,
    );
  });

  it('rejects comparison overlapping the current period', () => {
    assert.throws(
      () =>
        parseAdvancedKpisQuery({
          from: '2026-09-01',
          to: '2026-09-03',
          comparisonFrom: '2026-08-31',
          comparisonTo: '2026-09-02',
        }),
      BadRequestException,
    );
  });

  it('validates customer UUID and normalizes text filters', () => {
    const result = parseAdvancedKpisQuery({
      customerPartyId: '76000000-0000-4000-8000-000000000502',
      origin: ' Santos ',
      destination: 'São Paulo',
      status: 'completed',
    });
    assert.equal(result.customerPartyId, '76000000-0000-4000-8000-000000000502');
    assert.equal(result.origin, 'Santos');
    assert.equal(result.destination, 'São Paulo');
    assert.equal(result.status, 'completed');
  });

  it('rejects an invalid customer UUID', () => {
    assert.throws(
      () => parseAdvancedKpisQuery({ customerPartyId: 'invalid' }),
      BadRequestException,
    );
  });
});
