import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  parseCommodity,
  parseCustomFieldDefinition,
  parseLocation,
  parsePartyRequirement,
  requireCustomFieldEntityType,
  requireTaggedEntityType,
  validateCustomFieldValue,
} from './master-data-enrichment.validation.js';

const uuidA = '11111111-1111-4111-8111-111111111111';
const uuidB = '22222222-2222-4222-8222-222222222222';

function assertBadRequest(work: () => unknown): void {
  assert.throws(work, BadRequestException);
}

test('Wave 0016 accepts a standalone location with city and street', () => {
  const parsed = parseLocation({
    code: 'CD-SP-01',
    name: 'Centro de Distribuição SP',
    type: 'warehouse',
    cityId: uuidA,
    street: 'Rodovia Anhanguera',
    latitude: -23.5,
    longitude: -46.7,
  });

  assert.equal(parsed.partyId, null);
  assert.equal(parsed.cityId, uuidA);
  assert.equal(parsed.isActive, true);
});

test('Wave 0016 requires party and address as an inseparable pair', () => {
  assertBadRequest(() =>
    parseLocation({
      code: 'CLI-01',
      name: 'Cliente',
      type: 'customer',
      partyId: uuidA,
      cityId: uuidB,
      street: 'Rua A',
    }),
  );
});

test('Wave 0016 requires latitude and longitude as a pair', () => {
  assertBadRequest(() =>
    parseLocation({
      code: 'P-01',
      name: 'Ponto',
      type: 'support',
      cityId: uuidA,
      street: 'Rua B',
      latitude: -10,
    }),
  );
});

test('Wave 0016 normalizes commodity defaults', () => {
  const parsed = parseCommodity({ code: 'ELETR', name: 'Eletrônicos' });
  assert.equal(parsed.isHazardous, false);
  assert.equal(parsed.requiresTemperatureControl, false);
  assert.equal(parsed.isActive, true);
});

test('Wave 0016 requires a value for mandatory party requirements', () => {
  assertBadRequest(() => parsePartyRequirement({ requirementType: 'tracking' }));
});

test('Wave 0016 accepts controlled custom field entity/data types', () => {
  const parsed = parseCustomFieldDefinition({
    entityType: 'business_party',
    key: 'sap_code',
    label: 'Código SAP',
    dataType: 'string',
  });
  assert.equal(parsed.entityType, 'business_party');
  assert.equal(parsed.dataType, 'string');
});

test('Wave 0016 rejects unknown custom field entity types', () => {
  assertBadRequest(() => requireCustomFieldEntityType('arbitrary_table'));
});

test('Wave 0016 rejects locations as a tag target without a typed link', () => {
  assertBadRequest(() => requireTaggedEntityType('location'));
});

test('Wave 0016 enforces custom field runtime value types', () => {
  assert.equal(validateCustomFieldValue('number', 42.5), 42.5);
  assert.equal(validateCustomFieldValue('date', '2026-08-30'), '2026-08-30');
  assertBadRequest(() => validateCustomFieldValue('number', '42'));
  assertBadRequest(() => validateCustomFieldValue('boolean', 1));
});
