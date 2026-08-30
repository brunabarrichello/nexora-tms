import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  isTenantCatalog,
  parseCatalogSlug,
  parseReferenceListQuery,
  parseTenantCatalogCreate,
  parseTenantCatalogUpdate,
} from './reference-data.validation.js';

test('maps public slugs to explicit catalog kinds', () => {
  assert.equal(parseCatalogSlug('vehicle-types'), 'vehicleTypes');
  assert.equal(parseCatalogSlug('units-of-measure'), 'unitsOfMeasure');
  assert.throws(() => parseCatalogSlug('users'), BadRequestException);
});

test('separates tenant-scoped from global reference catalogs', () => {
  assert.equal(isTenantCatalog('vehicleTypes'), true);
  assert.equal(isTenantCatalog('tags'), true);
  assert.equal(isTenantCatalog('countries'), false);
});

test('parses bounded pagination and catalog filters', () => {
  assert.deepEqual(
    parseReferenceListQuery({ active: 'true', limit: '25', offset: '50', dimension: 'mass' }),
    {
      q: null,
      active: true,
      limit: 25,
      offset: 50,
      countryId: null,
      stateId: null,
      dimension: 'mass',
      subjectScope: null,
    },
  );
  assert.throws(() => parseReferenceListQuery({ limit: '101' }), BadRequestException);
  assert.throws(() => parseReferenceListQuery({ active: 'yes' }), BadRequestException);
});

test('normalizes a tenant catalog create payload without accepting tenantId', () => {
  assert.deepEqual(
    parseTenantCatalogCreate('vehicleTypes', {
      tenantId: '00000000-0000-4000-8000-000000000000',
      code: ' truck ',
      name: ' Truck ',
      description: '',
      defaultMaxWeightKg: '23000',
    }),
    {
      code: 'TRUCK',
      name: 'Truck',
      isActive: true,
      description: null,
      defaultMaxWeightKg: 23000,
    },
  );
});

test('requires document subject scope and supports safe lifecycle patching', () => {
  assert.throws(
    () => parseTenantCatalogCreate('documentTypes', { code: 'CTE', name: 'CT-e' }),
    BadRequestException,
  );
  assert.deepEqual(parseTenantCatalogUpdate('tags', { isActive: false }), { isActive: false });
  assert.throws(() => parseTenantCatalogUpdate('tags', {}), BadRequestException);
  assert.throws(
    () => parseTenantCatalogCreate('countries', { code: 'BR', name: 'Brasil' }),
    BadRequestException,
  );
});
