import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseAdvancedKpisQuery } from './advanced-kpis.service.js';

describe('parseAdvancedKpisQuery', () => {
  it('defaults to the last 30 days and a preceding comparison period', () => {
    const result = parseAdvancedKpisQuery({});
    expect(result.to.getTime() - result.from.getTime()).toBe(30 * 86_400_000);
    expect(result.comparisonTo.getTime()).toBe(result.from.getTime());
    expect(result.comparisonTo.getTime() - result.comparisonFrom.getTime()).toBe(30 * 86_400_000);
  });
  it('rejects an inverted period', () => {
    expect(() => parseAdvancedKpisQuery({ from: '2026-09-03', to: '2026-09-01' })).toThrow(BadRequestException);
  });
  it('rejects an oversized period', () => {
    expect(() => parseAdvancedKpisQuery({ from: '2025-01-01', to: '2026-09-03' })).toThrow(BadRequestException);
  });
  it('rejects comparison overlapping the current period', () => {
    expect(() => parseAdvancedKpisQuery({ from: '2026-09-01', to: '2026-09-03', comparisonFrom: '2026-08-31', comparisonTo: '2026-09-02' })).toThrow(BadRequestException);
  });
  it('validates customer UUID and normalizes text filters', () => {
    const result = parseAdvancedKpisQuery({ customerPartyId: '76000000-0000-4000-8000-000000000502', origin: ' Santos ', destination: 'São Paulo', status: 'completed' });
    expect(result.customerPartyId).toBe('76000000-0000-4000-8000-000000000502');
    expect(result.origin).toBe('Santos');
    expect(result.destination).toBe('São Paulo');
    expect(result.status).toBe('completed');
  });
  it('rejects an invalid customer UUID', () => {
    expect(() => parseAdvancedKpisQuery({ customerPartyId: 'invalid' })).toThrow(BadRequestException);
  });
});
