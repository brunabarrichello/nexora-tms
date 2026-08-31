import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  CapacityAssetService,
  type CapacityAsset,
  type CapacityAssetAuditEntry,
} from './capacity-asset.service.js';

@Controller('api/v1/capacity/assets')
@TenantAuthorized('capacity.read')
export class CapacityAssetController {
  constructor(private readonly assets: CapacityAssetService) {}

  @Get()
  list(): Promise<readonly CapacityAsset[]> {
    return this.assets.list();
  }

  @Post()
  @TenantAuthorized('capacity.write')
  create(@Body() body: unknown): Promise<CapacityAsset> {
    return this.assets.create(body);
  }

  @Get(':id/audit')
  audit(@Param('id') id: string): Promise<readonly CapacityAssetAuditEntry[]> {
    return this.assets.audit(id);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<CapacityAsset> {
    return this.assets.getById(id);
  }

  @Patch(':id')
  @TenantAuthorized('capacity.write')
  update(@Param('id') id: string, @Body() body: unknown): Promise<CapacityAsset> {
    return this.assets.update(id, body);
  }
}
