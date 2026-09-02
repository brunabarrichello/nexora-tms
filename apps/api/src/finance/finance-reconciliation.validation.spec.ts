import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  parseCreateFinancialReconciliationImport,
  parseReconcileFinancialEntry,
  parseReverseFinancialReconciliation,
} from './finance-reconciliation.validation.js';

test('parses provider-agnostic reconciliation import', () => {
  const parsed = parseCreateFinancialReconciliationImport({
    source: 'bank_statement',
    provider: 'generic-csv',
    externalBatchId: 'batch-001',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-02',
    entries: [
      {
        externalId: 'line-1',
        direction: 'credit',
        amount: '19000',
        currencyCode: 'brl',
        occurredAt: '2026-09-02T12:00:00Z',
        reference: 'NF-NEX53-001',
        rawPayload: { line: 1 },
      },
    ],
  });

  assert.equal(parsed.entries[0]?.amount, '19000.00');
  assert.equal(parsed.entries[0]?.currencyCode, 'BRL');
  assert.equal(parsed.entries[0]?.direction, 'credit');
});

test('rejects empty or oversized import entry sets', () => {
  assert.throws(
    () => parseCreateFinancialReconciliationImport({ source: 'csv', entries: [] }),
    /between 1 and 500/,
  );
  assert.throws(
    () =>
      parseCreateFinancialReconciliationImport({
        source: 'csv',
        entries: Array.from({ length: 501 }, () => ({
          direction: 'credit',
          amount: '1',
          currencyCode: 'BRL',
          occurredAt: '2026-09-02T12:00:00Z',
        })),
      }),
    /between 1 and 500/,
  );
});

test('requires coherent reconcile target and UUID', () => {
  const parsed = parseReconcileFinancialEntry({
    targetType: 'customer_receivable',
    targetId: '76000000-0000-4000-8000-000000000950',
  });
  assert.equal(parsed.matchMethod, 'manual');
  assert.equal(parsed.targetType, 'customer_receivable');

  assert.throws(
    () => parseReconcileFinancialEntry({ targetType: 'other', targetId: 'invalid' }),
    /targetType/,
  );
});

test('reversal reason must be meaningful', () => {
  assert.throws(() => parseReverseFinancialReconciliation({ reason: 'short' }), /at least 10/);
  assert.equal(
    parseReverseFinancialReconciliation({ reason: 'Bank line was linked to the wrong title' }).reason,
    'Bank line was linked to the wrong title',
  );
});
