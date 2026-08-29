import { Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  parseCreateBusinessPartyAddress,
  parseCreateBusinessPartyContact,
  parseUpdateBusinessPartyAddress,
  parseUpdateBusinessPartyContact,
  validateContactChannels,
  type BusinessPartyAddressType,
  type BusinessPartyContactType,
} from './business-party-directory.validation.js';
import { requireUuid } from './business-party.validation.js';

export interface BusinessPartyAddress {
  readonly id: string;
  readonly type: BusinessPartyAddressType;
  readonly label: string;
  readonly postalCode: string | null;
  readonly street: string;
  readonly number: string | null;
  readonly complement: string | null;
  readonly district: string | null;
  readonly city: string;
  readonly state: string;
  readonly countryCode: string;
  readonly operationalReference: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BusinessPartyContact {
  readonly id: string;
  readonly addressId: string | null;
  readonly type: BusinessPartyContactType;
  readonly name: string;
  readonly title: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly whatsapp: string | null;
  readonly operationalReference: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BusinessPartyDirectory {
  readonly addresses: readonly BusinessPartyAddress[];
  readonly contacts: readonly BusinessPartyContact[];
}

interface AddressRow {
  readonly id: string;
  readonly type: BusinessPartyAddressType;
  readonly label: string;
  readonly postal_code: string | null;
  readonly street: string;
  readonly number: string | null;
  readonly complement: string | null;
  readonly district: string | null;
  readonly city: string;
  readonly state: string;
  readonly country_code: string;
  readonly operational_reference: string | null;
  readonly is_active: boolean;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface ContactRow {
  readonly id: string;
  readonly address_id: string | null;
  readonly type: BusinessPartyContactType;
  readonly name: string;
  readonly title: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly whatsapp: string | null;
  readonly operational_reference: string | null;
  readonly is_active: boolean;
  readonly created_at: Date;
  readonly updated_at: Date;
}

const addressSelect = `
  SELECT
    id::text AS id,
    type,
    label,
    postal_code,
    street,
    number,
    complement,
    district,
    city,
    state,
    country_code,
    operational_reference,
    is_active,
    created_at,
    updated_at
  FROM business_party_addresses
`;

const contactSelect = `
  SELECT
    id::text AS id,
    address_id::text AS address_id,
    type,
    name,
    title,
    email,
    phone,
    whatsapp,
    operational_reference,
    is_active,
    created_at,
    updated_at
  FROM business_party_contacts
`;

@Injectable()
export class BusinessPartyDirectoryService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async listAddresses(partyIdInput: string): Promise<readonly BusinessPartyAddress[]> {
    const partyId = requireUuid(partyIdInput, 'partyId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireParty(client, partyId);
      return this.listAddressesWithClient(client, partyId, false);
    });
  }

  async createAddress(partyIdInput: string, input: unknown): Promise<BusinessPartyAddress> {
    const partyId = requireUuid(partyIdInput, 'partyId');
    const data = parseCreateBusinessPartyAddress(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireParty(client, partyId);
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO business_party_addresses (
           tenant_id, party_id, type, label, postal_code, street, number, complement,
           district, city, state, country_code, operational_reference
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
         )
         RETURNING id::text AS id`,
        [
          context.tenantId,
          partyId,
          data.type,
          data.label,
          data.postalCode,
          data.street,
          data.number,
          data.complement,
          data.district,
          data.city,
          data.state,
          data.countryCode,
          data.operationalReference,
        ],
      );

      return this.requireAddress(client, partyId, inserted.rows[0]!.id);
    });
  }

  async updateAddress(
    partyIdInput: string,
    addressIdInput: string,
    input: unknown,
  ): Promise<BusinessPartyAddress> {
    const partyId = requireUuid(partyIdInput, 'partyId');
    const addressId = requireUuid(addressIdInput, 'addressId');
    const patch = parseUpdateBusinessPartyAddress(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireParty(client, partyId);
      const before = await this.requireAddress(client, partyId, addressId);

      await client.query(
        `UPDATE business_party_addresses
            SET type = $3,
                label = $4,
                postal_code = $5,
                street = $6,
                number = $7,
                complement = $8,
                district = $9,
                city = $10,
                state = $11,
                country_code = $12,
                operational_reference = $13,
                is_active = $14,
                updated_at = now()
          WHERE party_id = $1::uuid
            AND id = $2::uuid`,
        [
          partyId,
          addressId,
          patch.type ?? before.type,
          patch.label ?? before.label,
          patch.postalCode !== undefined ? patch.postalCode : before.postalCode,
          patch.street ?? before.street,
          patch.number !== undefined ? patch.number : before.number,
          patch.complement !== undefined ? patch.complement : before.complement,
          patch.district !== undefined ? patch.district : before.district,
          patch.city ?? before.city,
          patch.state ?? before.state,
          patch.countryCode ?? before.countryCode,
          patch.operationalReference !== undefined
            ? patch.operationalReference
            : before.operationalReference,
          patch.isActive ?? before.isActive,
        ],
      );

      return this.requireAddress(client, partyId, addressId);
    });
  }

  async listContacts(partyIdInput: string): Promise<readonly BusinessPartyContact[]> {
    const partyId = requireUuid(partyIdInput, 'partyId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireParty(client, partyId);
      return this.listContactsWithClient(client, partyId, false);
    });
  }

  async createContact(partyIdInput: string, input: unknown): Promise<BusinessPartyContact> {
    const partyId = requireUuid(partyIdInput, 'partyId');
    const data = parseCreateBusinessPartyContact(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireParty(client, partyId);
      if (data.addressId) {
        await this.requireAddress(client, partyId, data.addressId);
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO business_party_contacts (
           tenant_id, party_id, address_id, type, name, title, email, phone, whatsapp,
           operational_reference
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id::text AS id`,
        [
          context.tenantId,
          partyId,
          data.addressId,
          data.type,
          data.name,
          data.title,
          data.email,
          data.phone,
          data.whatsapp,
          data.operationalReference,
        ],
      );

      return this.requireContact(client, partyId, inserted.rows[0]!.id);
    });
  }

  async updateContact(
    partyIdInput: string,
    contactIdInput: string,
    input: unknown,
  ): Promise<BusinessPartyContact> {
    const partyId = requireUuid(partyIdInput, 'partyId');
    const contactId = requireUuid(contactIdInput, 'contactId');
    const patch = parseUpdateBusinessPartyContact(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireParty(client, partyId);
      const before = await this.requireContact(client, partyId, contactId);
      const addressId = patch.addressId !== undefined ? patch.addressId : before.addressId;
      const email = patch.email !== undefined ? patch.email : before.email;
      const phone = patch.phone !== undefined ? patch.phone : before.phone;
      const whatsapp = patch.whatsapp !== undefined ? patch.whatsapp : before.whatsapp;
      validateContactChannels(email, phone, whatsapp);

      if (addressId) {
        await this.requireAddress(client, partyId, addressId);
      }

      await client.query(
        `UPDATE business_party_contacts
            SET address_id = $3::uuid,
                type = $4,
                name = $5,
                title = $6,
                email = $7,
                phone = $8,
                whatsapp = $9,
                operational_reference = $10,
                is_active = $11,
                updated_at = now()
          WHERE party_id = $1::uuid
            AND id = $2::uuid`,
        [
          partyId,
          contactId,
          addressId,
          patch.type ?? before.type,
          patch.name ?? before.name,
          patch.title !== undefined ? patch.title : before.title,
          email,
          phone,
          whatsapp,
          patch.operationalReference !== undefined
            ? patch.operationalReference
            : before.operationalReference,
          patch.isActive ?? before.isActive,
        ],
      );

      return this.requireContact(client, partyId, contactId);
    });
  }

  async getActiveDirectory(partyIdInput: string): Promise<BusinessPartyDirectory> {
    const partyId = requireUuid(partyIdInput, 'partyId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireParty(client, partyId);
      const [addresses, contacts] = await Promise.all([
        this.listAddressesWithClient(client, partyId, true),
        this.listContactsWithClient(client, partyId, true),
      ]);
      return { addresses, contacts };
    });
  }

  private async requireParty(client: TenantQueryClient, partyId: string): Promise<void> {
    const result = await client.query(`SELECT id FROM business_parties WHERE id = $1::uuid`, [
      partyId,
    ]);
    if (result.rowCount !== 1) {
      throw new NotFoundException('Business party was not found');
    }
  }

  private async listAddressesWithClient(
    client: TenantQueryClient,
    partyId: string,
    activeOnly: boolean,
  ): Promise<readonly BusinessPartyAddress[]> {
    const result = await client.query<AddressRow>(
      `${addressSelect}
       WHERE party_id = $1::uuid
         AND ($2::boolean = false OR is_active = true)
       ORDER BY is_active DESC, label, id`,
      [partyId, activeOnly],
    );
    return result.rows.map(mapAddress);
  }

  private async listContactsWithClient(
    client: TenantQueryClient,
    partyId: string,
    activeOnly: boolean,
  ): Promise<readonly BusinessPartyContact[]> {
    const result = await client.query<ContactRow>(
      `${contactSelect}
       WHERE party_id = $1::uuid
         AND ($2::boolean = false OR is_active = true)
       ORDER BY is_active DESC, name, id`,
      [partyId, activeOnly],
    );
    return result.rows.map(mapContact);
  }

  private async requireAddress(
    client: TenantQueryClient,
    partyId: string,
    addressId: string,
  ): Promise<BusinessPartyAddress> {
    const result = await client.query<AddressRow>(
      `${addressSelect}
       WHERE party_id = $1::uuid
         AND id = $2::uuid`,
      [partyId, addressId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Business party address was not found');
    }
    return mapAddress(row);
  }

  private async requireContact(
    client: TenantQueryClient,
    partyId: string,
    contactId: string,
  ): Promise<BusinessPartyContact> {
    const result = await client.query<ContactRow>(
      `${contactSelect}
       WHERE party_id = $1::uuid
         AND id = $2::uuid`,
      [partyId, contactId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Business party contact was not found');
    }
    return mapContact(row);
  }
}

function mapAddress(row: AddressRow): BusinessPartyAddress {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    postalCode: row.postal_code,
    street: row.street,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    countryCode: row.country_code,
    operationalReference: row.operational_reference,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapContact(row: ContactRow): BusinessPartyContact {
  return {
    id: row.id,
    addressId: row.address_id,
    type: row.type,
    name: row.name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    operationalReference: row.operational_reference,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
