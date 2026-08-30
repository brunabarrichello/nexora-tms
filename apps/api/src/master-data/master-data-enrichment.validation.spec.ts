import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

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

function expectBadRequest(work: () => unknown): void {
  expect(work).toThrow(BadRequestException);
}

describe('Wave 0016 master-data validation', () => {
  it('accepts a standalone location with city and street', () => {
    const parsed = parseLocation({
      code: 'CD-SP-01',
      name: 'Centro de Distribuição SP',
      type: 'warehouse',
      cityId: uuidA,
      street: 'Rodovia Anhanguera',
      latitude: -23.5,
      longitude: -46.7,
    });

    expect(parsed.partyId).toBeNull();
    expect(parsed.cityId).toBe(uuidA);
    expect(parsed.isActive).toBe(true);
  });

  it('requires party and address as an inseparable pair', () => {
    expectBadRequest(() =>
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

  it('requires latitude and longitude as a pair', () => {
    expectBadRequest(() =>
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

  it('normalizes commodity defaults', () => {
    const parsed = parseCommodity({ code: 'ELETR', name: 'Eletrônicos' });
    expect(parsed.isHazardous).toBe(false);
    expect(parsed.requiresTemperatureControl).toBe(false);
    expect(parsed.isActive).toBe(true);
  });

  it('requires a value for mandatory party requirements', () => {
    expectBadRequest(() => parsePartyRequirement({ requirementType: 'tracking' }));
  });

  it('accepts controlled custom field entity/data types', () => {
    const parsed = parseCustomFieldDefinition({
      entityType: 'business_party',
      key: 'sap_code',
      label: 'Código SAP',
      dataType: 'string',
    });
    expect(parsed.entityType).toBe('business_party');
    expect(parsed.dataType).toBe('string');
  });

  it('rejects unknown custom field entity types', () => {
    expectBadRequest(() => requireCustomFieldEntityType('arbitrary_table'));
  });

  it('rejects locations as a tag target because no typed link table exists', () => {
    expectBadRequest(() => requireTaggedEntityType('location'));
  });

  it('enforces custom field runtime value types', () => {
    expect(validateCustomFieldValue('number', 42.5)).toBe(42.5);
    expect(validateCustomFieldValue('date', '2026-08-30')).toBe('2026-08-30');
    expectBadRequest(() => validateCustomFieldValue('number', '42'));
    expectBadRequest(() => validateCustomFieldValue('boolean', 1));
  });
});
