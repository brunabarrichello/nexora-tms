import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  parseTripOccurrence,
  parseTripOccurrenceDocument,
  parseTripOccurrenceStatus,
  parseTripOccurrenceTreatment,
} from './trip-occurrence.validation.js';

const USER_ID = '71000000-0000-4000-8000-000000000101';
const DOCUMENT_ID = '72000000-0000-4000-8000-000000000021';

test('trip occurrence input normalizes defaults and coordinates', () => {
  const parsed = parseTripOccurrence({
    occurrenceType: 'delay',
    occurredAt: '2026-09-02T10:00:00-03:00',
    latitude: -23.55,
    longitude: -46.63,
    description: '  Traffic delay  ',
    responsibleUserId: USER_ID,
  });

  assert.equal(parsed.severity, 'medium');
  assert.equal(parsed.description, 'Traffic delay');
  assert.equal(parsed.occurredAt, '2026-09-02T13:00:00.000Z');
  assert.equal(parsed.responsibleUserId, USER_ID);
});

test('trip occurrence input rejects incomplete coordinate pair', () => {
  assert.throws(
    () =>
      parseTripOccurrence({
        occurrenceType: 'damage',
        occurredAt: '2026-09-02T13:00:00Z',
        latitude: -23.55,
        description: 'Cargo damage',
      }),
    /latitude and longitude must be provided together/,
  );
});

test('treatment requires a note and can explicitly clear responsibility', () => {
  assert.throws(() => parseTripOccurrenceTreatment({}), /note must be a string/);
  const parsed = parseTripOccurrenceTreatment({
    note: 'Transferred to operations',
    responsibleUserId: null,
  });
  assert.equal(parsed.changesResponsible, true);
  assert.equal(parsed.responsibleUserId, null);
});

test('status and document relation validate stable domains', () => {
  assert.equal(parseTripOccurrenceStatus({ status: 'resolved' }).status, 'resolved');
  assert.equal(parseTripOccurrenceDocument({ documentId: DOCUMENT_ID }).relationType, 'evidence');
  assert.throws(() => parseTripOccurrenceStatus({ status: 'closed' }), /status is invalid/);
  assert.throws(
    () => parseTripOccurrenceDocument({ documentId: DOCUMENT_ID, relationType: 'receipt' }),
    /relationType is invalid/,
  );
});
