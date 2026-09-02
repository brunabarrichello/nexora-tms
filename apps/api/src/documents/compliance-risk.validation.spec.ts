import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  parseComplianceRiskDecision,
  parseComplianceRiskSubjectScope,
} from './compliance-risk.validation.js';

test('Risk subject scope parser accepts only supported subjects', () => {
  for (const scope of ['party', 'driver', 'asset', 'document']) {
    assert.equal(parseComplianceRiskSubjectScope(scope), scope);
  }
  assert.throws(() => parseComplianceRiskSubjectScope('unknown'), /subjectScope/);
});

test('Manual decision parser normalizes a supported decision and reason', () => {
  assert.deepEqual(
    parseComplianceRiskDecision({
      decision: 'review',
      reason: '  Manual compliance review required.  ',
    }),
    { decision: 'review', reason: 'Manual compliance review required.' },
  );
  assert.throws(
    () => parseComplianceRiskDecision({ decision: 'other', reason: 'Unsupported decision value.' }),
    /decision/,
  );
  assert.throws(
    () => parseComplianceRiskDecision({ decision: 'review', reason: 'short' }),
    /reason/,
  );
});
