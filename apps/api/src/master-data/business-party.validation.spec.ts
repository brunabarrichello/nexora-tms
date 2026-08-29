import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  parseCreateBusinessParty,
  parseUpdateBusinessParty,
} from './business-party.validation.js';

test('create validation normalizes fiscal id, contacts and roles', () => {
  const parsed = parseCreateBusinessParty({
    taxId: '12.345.678/0001-90',
    legalName: '  Nexora Cliente Ltda  ',
    tradeName: '  Nexora Cliente  ',
    email: ' OPERACAO@EXAMPLE.COM ',
    phone: '(11) 99999-9999',
    roles: ['shipper', 'customer', 'shipper'],
  });

  assert.deepEqual(parsed, {
    taxId: '12345678000190',
    legalName: 'Nexora Cliente Ltda',
    tradeName: 'Nexora Cliente',
    email: 'operacao@example.com',
    phone: '(11) 99999-9999',
    roles: ['customer', 'shipper'],
  });
});

test('create validation rejects malformed fiscal identifiers', () => {
  assert.throws(
    () =>
      parseCreateBusinessParty({
        taxId: '111.111.111-11',
        legalName: 'Cliente Inválido',
        roles: ['customer'],
      }),
    BadRequestException,
  );
});

test('update validation accepts inactive status and role changes', () => {
  assert.deepEqual(
    parseUpdateBusinessParty({ status: 'inactive', roles: ['consignee', 'customer'] }),
    {
      status: 'inactive',
      roles: ['consignee', 'customer'],
    },
  );
});

test('update validation rejects an empty patch', () => {
  assert.throws(() => parseUpdateBusinessParty({}), BadRequestException);
});
