import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
  parseCreateBusinessPartyAddress,
  parseCreateBusinessPartyContact,
  parseUpdateBusinessPartyAddress,
  parseUpdateBusinessPartyContact,
} from './business-party-directory.validation.js';

test('address validation normalizes UF and defaults country to BR', () => {
  assert.deepEqual(
    parseCreateBusinessPartyAddress({
      type: 'pickup',
      label: '  CD Principal  ',
      postalCode: '01234-567',
      street: ' Avenida Central ',
      number: '100',
      city: ' São Paulo ',
      state: 'sp',
      operationalReference: ' Portaria 2 ',
    }),
    {
      type: 'pickup',
      label: 'CD Principal',
      postalCode: '01234-567',
      street: 'Avenida Central',
      number: '100',
      complement: null,
      district: null,
      city: 'São Paulo',
      state: 'SP',
      countryCode: 'BR',
      operationalReference: 'Portaria 2',
    },
  );
});

test('address validation rejects an invalid UF', () => {
  assert.throws(
    () =>
      parseCreateBusinessPartyAddress({
        type: 'delivery',
        label: 'Destino',
        street: 'Rua A',
        city: 'Curitiba',
        state: 'Paraná',
      }),
    BadRequestException,
  );
});

test('contact validation normalizes email and accepts an associated address', () => {
  assert.deepEqual(
    parseCreateBusinessPartyContact({
      addressId: '00000000-0000-4000-8000-000000000501',
      type: 'logistics',
      name: '  Operação CD  ',
      email: ' OPERACAO@EXAMPLE.COM ',
      whatsapp: '(11) 99999-9999',
    }),
    {
      addressId: '00000000-0000-4000-8000-000000000501',
      type: 'logistics',
      name: 'Operação CD',
      title: null,
      email: 'operacao@example.com',
      phone: null,
      whatsapp: '(11) 99999-9999',
      operationalReference: null,
    },
  );
});

test('contact validation requires at least one communication channel', () => {
  assert.throws(
    () =>
      parseCreateBusinessPartyContact({
        type: 'commercial',
        name: 'Contato sem canal',
      }),
    BadRequestException,
  );
});

test('address update supports inactivation without deletion', () => {
  assert.deepEqual(parseUpdateBusinessPartyAddress({ isActive: false }), { isActive: false });
});

test('contact update supports detaching an address and keeping another channel', () => {
  assert.deepEqual(parseUpdateBusinessPartyContact({ addressId: null, phone: '(41) 3333-4444' }), {
    addressId: null,
    phone: '(41) 3333-4444',
  });
});

test('directory updates reject empty patches', () => {
  assert.throws(() => parseUpdateBusinessPartyAddress({}), BadRequestException);
  assert.throws(() => parseUpdateBusinessPartyContact({}), BadRequestException);
});
