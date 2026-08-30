import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  parseDocumentCreate,
  parseDocumentLink,
  parseDocumentListQuery,
  parseDocumentValidation,
  parseDocumentVersion,
} from './document.validation.js';

const uuid = '00000000-0000-4000-8000-000000000001';

test('document metadata validates date windows and blocking flag', () => {
  const value = parseDocumentCreate({
    documentTypeId: uuid,
    title: 'CT-e 123',
    issuedOn: '2026-08-30',
    expiresOn: '2026-09-30',
    isBlocking: true,
  });
  assert.equal(value.title, 'CT-e 123');
  assert.equal(value.isBlocking, true);
  assert.throws(
    () =>
      parseDocumentCreate({
        documentTypeId: uuid,
        title: 'Invalid',
        issuedOn: '2026-09-02',
        expiresOn: '2026-09-01',
      }),
    BadRequestException,
  );
});

test('version requires immutable provider metadata and sha256', () => {
  const value = parseDocumentVersion({
    storageProvider: 's3',
    storageKey: 'tenant/document/file.pdf',
    fileName: 'file.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 128,
    sha256: 'A'.repeat(64),
  });
  assert.equal(value.sha256, 'a'.repeat(64));
  assert.equal(value.source, 'upload');
  assert.throws(
    () =>
      parseDocumentVersion({
        storageProvider: 's3',
        storageKey: 'x',
        fileName: 'x.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1,
        sha256: 'not-a-hash',
      }),
    BadRequestException,
  );
});

test('validation accepts immutable validation history input', () => {
  const value = parseDocumentValidation({
    versionId: uuid,
    validationType: 'antifraud',
    status: 'warning',
    details: { score: 0.81 },
  });
  assert.equal(value.validationType, 'antifraud');
  assert.deepEqual(value.details, { score: 0.81 });
});

test('typed links accept only whitelisted targets', () => {
  assert.equal(
    parseDocumentLink({ targetKind: 'contract', targetId: uuid }).targetKind,
    'contract',
  );
  assert.throws(
    () => parseDocumentLink({ targetKind: 'trip', targetId: uuid }),
    BadRequestException,
  );
});

test('list query is bounded and validates expiry dates', () => {
  const value = parseDocumentListQuery({ limit: '25', offset: '10', expiringBefore: '2026-09-30' });
  assert.equal(value.limit, 25);
  assert.equal(value.offset, 10);
  assert.throws(() => parseDocumentListQuery({ limit: '1000' }), BadRequestException);
});
