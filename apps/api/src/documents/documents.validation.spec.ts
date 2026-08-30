import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  parseCommitUpload,
  parseCreateDocument,
  parseDeleteDocument,
  parseDocumentValidation,
  parsePartyLink,
  parsePrepareUpload,
  parseTransportRequestLink,
  parseUpdateDocument,
  requireUuid,
} from './documents.validation.js';

const uuid = '00000000-0000-4000-8000-000000000001';

test('creates document metadata with controlled dates and metadata', () => {
  const value = parseCreateDocument({
    documentTypeId: uuid,
    title: 'CNH',
    issuedOn: '2026-08-30',
    expiresOn: '2031-08-30',
    metadata: { category: 'E' },
  });
  assert.equal(value.title, 'CNH');
  assert.equal(value.expiresOn, '2031-08-30');
  assert.deepEqual(value.metadata, { category: 'E' });
});

test('rejects inverted document validity dates', () => {
  assert.throws(
    () =>
      parseCreateDocument({
        documentTypeId: uuid,
        title: 'Expired before issued',
        issuedOn: '2026-09-02',
        expiresOn: '2026-09-01',
      }),
    BadRequestException,
  );
});

test('update requires at least one mutable field', () => {
  assert.throws(() => parseUpdateDocument({}), BadRequestException);
  assert.equal(parseUpdateDocument({ title: 'Updated' }).title, 'Updated');
});

test('upload preparation validates size and optional SHA-256', () => {
  const checksum = 'a'.repeat(64);
  const value = parsePrepareUpload({
    originalFileName: 'document.pdf',
    mimeType: 'application/pdf',
    expectedByteSize: 1024,
    checksumSha256: checksum,
  });
  assert.equal(value.expectedByteSize, 1024);
  assert.equal(value.checksumSha256, checksum);
  assert.throws(
    () =>
      parsePrepareUpload({
        originalFileName: 'document.pdf',
        mimeType: 'application/pdf',
        expectedByteSize: 0,
      }),
    BadRequestException,
  );
  assert.throws(
    () =>
      parsePrepareUpload({
        originalFileName: 'document.pdf',
        mimeType: 'application/pdf',
        checksumSha256: 'not-a-sha256',
      }),
    BadRequestException,
  );
});

test('commit upload only accepts controlled sources', () => {
  assert.equal(parseCommitUpload({ uploadId: 'opaque-upload' }).source, 'upload');
  assert.throws(
    () => parseCommitUpload({ uploadId: 'opaque-upload', source: 'public-url' }),
    BadRequestException,
  );
});

test('validation result and type are controlled', () => {
  const value = parseDocumentValidation({
    documentVersionId: uuid,
    validationType: 'manual',
    result: 'valid',
  });
  assert.equal(value.result, 'valid');
  assert.throws(
    () => parseDocumentValidation({ validationType: 'manual', result: 'maybe' }),
    BadRequestException,
  );
});

test('typed party and transport-request links reject arbitrary relation types', () => {
  assert.equal(parsePartyLink({ relationType: 'compliance' }).relationType, 'compliance');
  assert.equal(parseTransportRequestLink({ relationType: 'reference' }).relationType, 'reference');
  assert.throws(() => parsePartyLink({ relationType: 'driver' }), BadRequestException);
  assert.throws(() => parseTransportRequestLink({ relationType: 'trip' }), BadRequestException);
});

test('soft delete requires a non-empty reason', () => {
  assert.equal(parseDeleteDocument({ reason: 'Superseded record' }).reason, 'Superseded record');
  assert.throws(() => parseDeleteDocument({ reason: ' ' }), BadRequestException);
});

test('UUID validation rejects malformed identifiers', () => {
  assert.equal(requireUuid(uuid), uuid);
  assert.throws(() => requireUuid('not-a-uuid'), BadRequestException);
});
