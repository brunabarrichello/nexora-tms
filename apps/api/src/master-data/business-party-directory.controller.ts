import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import {
  BusinessPartyDirectoryService,
  type BusinessPartyAddress,
  type BusinessPartyContact,
  type BusinessPartyDirectory,
} from './business-party-directory.service.js';

@Controller('api/v1/master-data/business-parties')
@UseGuards(TenantRuntimeGateGuard)
export class BusinessPartyDirectoryController {
  constructor(private readonly directory: BusinessPartyDirectoryService) {}

  @Get(':partyId/directory')
  getActiveDirectory(@Param('partyId') partyId: string): Promise<BusinessPartyDirectory> {
    return this.directory.getActiveDirectory(partyId);
  }

  @Get(':partyId/addresses')
  listAddresses(@Param('partyId') partyId: string): Promise<readonly BusinessPartyAddress[]> {
    return this.directory.listAddresses(partyId);
  }

  @Post(':partyId/addresses')
  createAddress(
    @Param('partyId') partyId: string,
    @Body() body: unknown,
  ): Promise<BusinessPartyAddress> {
    return this.directory.createAddress(partyId, body);
  }

  @Patch(':partyId/addresses/:addressId')
  updateAddress(
    @Param('partyId') partyId: string,
    @Param('addressId') addressId: string,
    @Body() body: unknown,
  ): Promise<BusinessPartyAddress> {
    return this.directory.updateAddress(partyId, addressId, body);
  }

  @Get(':partyId/contacts')
  listContacts(@Param('partyId') partyId: string): Promise<readonly BusinessPartyContact[]> {
    return this.directory.listContacts(partyId);
  }

  @Post(':partyId/contacts')
  createContact(
    @Param('partyId') partyId: string,
    @Body() body: unknown,
  ): Promise<BusinessPartyContact> {
    return this.directory.createContact(partyId, body);
  }

  @Patch(':partyId/contacts/:contactId')
  updateContact(
    @Param('partyId') partyId: string,
    @Param('contactId') contactId: string,
    @Body() body: unknown,
  ): Promise<BusinessPartyContact> {
    return this.directory.updateContact(partyId, contactId, body);
  }
}
