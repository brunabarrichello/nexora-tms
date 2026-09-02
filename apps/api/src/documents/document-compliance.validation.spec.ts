import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  parseComplianceContext,
  parseComplianceOverride,
  parseCompliancePolicy,
  parseComplianceSubjectScope,
} from './document-compliance.validation.js';

const typeId = '11111111-1111-4111-8111-111111111111';
const subjectId = '22222222-2222-4222-8222-222222222222';

test('parses a blocking document compliance policy with safe defaults', () => {
  assert.deepEqual(
    parseCompliancePolicy({
      documentTypeId: typeId,
      requiredForContracting: true,
    }),
    {
      documentTypeId: typeId,
      requiredForContracting: true,
      requiredForTrip: false,
      warningDays: 30,
      blockWhenExpiringSoon: false,
      blockWhenPending: true,
      blockWhenRejected: true,
      blockWhenExpired: true,
      isActive: true,
    },
  );
});

test('requires at least one enforcement context', () => {
  assert.throws(
    () => parseCompliancePolicy({ documentTypeId: typeId }),
    BadRequestException,
  );
});

test('rejects warning windows beyond one year', () => {
  assert.throws(
    () =>
      parseCompliancePolicy({
        documentTypeId: typeId,
        requiredForTrip: true,
        warningDays: 366,
      }),
    BadRequestException,
  );
});

test('parses a temporary administrative override', () => {
  const validUntil = new Date(Date.now() + 86_400_000).toISOString();
  assert.deepEqual(
    parseComplianceOverride({
      context: 'trip',
      subjectScope: 'driver',
      subjectId,
      documentTypeId: typeId,
      reason: 'Operação excepcional aprovada pelo administrador',
      validUntil,
    }),
    {
      context: 'trip',
      subjectScope: 'driver',
      subjectId,
      documentTypeId: typeId,
      reason: 'Operação excepcional aprovada pelo administrador',
      validUntil,
    },
  );
});

test('administrative override cannot exceed 30 days', () => {
  assert.throws(
    () =>
      parseComplianceOverride({
        context: 'contracting',
        subjectScope: 'asset',
        subjectId,
        documentTypeId: typeId,
        reason: 'Exceção longa que deve ser rejeitada pelo contrato',
        validUntil: new Date(Date.now() + 31 * 86_400_000).toISOString(),
      }),
    BadRequestException,
  );
});

test('parses supported contexts and subject scopes', () => {
  assert.equal(parseComplianceContext('contracting'), 'contracting');
  assert.equal(parseComplianceContext('trip'), 'trip');
  assert.equal(parseComplianceSubjectScope('party'), 'party');
  assert.equal(parseComplianceSubjectScope('driver'), 'driver');
  assert.equal(parseComplianceSubjectScope('asset'), 'asset');
});
