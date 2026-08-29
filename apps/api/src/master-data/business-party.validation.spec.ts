import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { parseCreateBusinessParty, parseUpdateBusinessParty } from './business-party.validation.js';

test('create validation normalizes fiscal id, contacts and customer roles', () => {
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
    homologationStatus: null,
    homologationNotes: null,
  });
});

test('create validation defaults transport partners to pending homologation', () => {
  assert.deepEqual(
    parseCreateBusinessParty({
      taxId: '12.345.678/0001-91',
      legalName: 'Transportadora Parceira Ltda',
      roles: ['supplier', 'carrier'],
      homologationNotes: 'Documentação inicial recebida',
    }),
    {
      taxId: '12345678000191',
      legalName: 'Transportadora Parceira Ltda',
      tradeName: null,
      email: null,
      phone: null,
      roles: ['carrier', 'supplier'],
      homologationStatus: 'pending',
      homologationNotes: 'Documentação inicial recebida',
    },
  );
});

test('create validation accepts an explicit partner homologation status', () => {
  const parsed = parseCreateBusinessParty({
    taxId: '12.345.678/0001-92',
    legalName: 'Fornecedor Homologado Ltda',
    roles: ['supplier'],
    homologationStatus: 'approved',
  });

  assert.equal(parsed.homologationStatus, 'approved');
});

test('create validation rejects homologation data for non-partner roles', () => {
  assert.throws(
    () =>
      parseCreateBusinessParty({
        taxId: '12.345.678/0001-93',
        legalName: 'Cliente Sem Papel Parceiro Ltda',
        roles: ['customer'],
        homologationStatus: 'pending',
      }),
    BadRequestException,
  );
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

test('update validation accepts partner homologation changes', () => {
  assert.deepEqual(
    parseUpdateBusinessParty({
      roles: ['partner'],
      homologationStatus: 'rejected',
      homologationNotes: 'Documentação vencida',
    }),
    {
      roles: ['partner'],
      homologationStatus: 'rejected',
      homologationNotes: 'Documentação vencida',
    },
  );
});

test('update validation rejects homologation with explicit non-partner roles', () => {
  assert.throws(
    () =>
      parseUpdateBusinessParty({
        roles: ['customer'],
        homologationStatus: 'approved',
      }),
    BadRequestException,
  );
});

test('update validation rejects an empty patch', () => {
  assert.throws(() => parseUpdateBusinessParty({}), BadRequestException);
});
