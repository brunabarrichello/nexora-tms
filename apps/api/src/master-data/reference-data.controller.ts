import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  ReferenceDataService,
  type ReferenceDataItem,
  type ReferenceDataPage,
} from './reference-data.service.js';
import { parseCatalogSlug } from './reference-data.validation.js';

@Controller('api/v1/reference-data')
@TenantAuthorized('master-data.read')
export class ReferenceDataController {
  constructor(private readonly referenceData: ReferenceDataService) {}

  @Get(':catalog/:id')
  getById(@Param('catalog') catalog: string, @Param('id') id: string): Promise<ReferenceDataItem> {
    return this.referenceData.getById(parseCatalogSlug(catalog), id);
  }

  @Get(':catalog')
  list(
    @Param('catalog') catalog: string,
    @Query() query: Record<string, unknown>,
  ): Promise<ReferenceDataPage> {
    return this.referenceData.list(parseCatalogSlug(catalog), query);
  }

  @Post(':catalog')
  @TenantAuthorized('master-data.write')
  create(@Param('catalog') catalog: string, @Body() body: unknown): Promise<ReferenceDataItem> {
    return this.referenceData.create(parseCatalogSlug(catalog), body);
  }

  @Patch(':catalog/:id')
  @TenantAuthorized('master-data.write')
  update(
    @Param('catalog') catalog: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<ReferenceDataItem> {
    return this.referenceData.update(parseCatalogSlug(catalog), id, body);
  }
}
