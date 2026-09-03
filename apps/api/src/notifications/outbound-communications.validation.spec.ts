import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  parseCreateTemplate,
  parsePreference,
  parseQueueCommunication,
} from './outbound-communications.validation.js';

const recipientId = '77000000-0000-4000-8000-000000000501';
const templateId = '77000000-0000-4000-8000-000000000601';

test('communication preference requires granted consent when channel is enabled', () => {
  assert.throws(
    () =>
      parsePreference({
        recipientType: 'driver',
        recipientId,
        channel: 'whatsapp',
        enabled: true,
        consentStatus: 'denied',
        policyVersion: '2026-09',
      }),
    /granted consent/,
  );
});

test('granted communication consent requires source and timestamp', () => {
  assert.throws(
    () =>
      parsePreference({
        recipientType: 'driver',
        recipientId,
        channel: 'sms',
        enabled: true,
        consentStatus: 'granted',
        policyVersion: '2026-09',
      }),
    /consentSource and consentedAt/,
  );
});

test('email template requires a subject', () => {
  assert.throws(
    () =>
      parseCreateTemplate({
        templateKey: 'trip.started',
        channel: 'email',
        version: 1,
        bodyTemplate: 'Trip {{tripId}} started',
      }),
    /subjectTemplate/,
  );
});

test('queue input accepts only canonical recipient ids and JSON variables', () => {
  const parsed = parseQueueCommunication({
    templateId,
    recipientType: 'party_contact',
    recipientId,
    variables: { tripId: 'TRIP-123' },
    idempotencyKey: 'trip-123-customer-started',
    maxAttempts: 4,
  });
  assert.equal(parsed.recipientType, 'party_contact');
  assert.equal(parsed.maxAttempts, 4);
  assert.deepEqual(parsed.variables, { tripId: 'TRIP-123' });
});

test('queue input rejects arbitrary destination fields by ignoring them', () => {
  const parsed = parseQueueCommunication({
    templateId,
    recipientType: 'driver',
    recipientId,
    variables: {},
    idempotencyKey: 'driver-trip-started',
    destination: '+5511999999999',
  });
  assert.equal('destination' in parsed, false);
});
