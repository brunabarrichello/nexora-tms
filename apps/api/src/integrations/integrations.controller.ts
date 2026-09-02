import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { IntegrationsService } from './integrations.service.js';

@Controller('api/v1/integrations')
@TenantAuthorized('audit.read')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('clients')
  listClients(@Query('limit') limit?: string) {
    return this.integrations.listClients(limit);
  }

  @Post('clients')
  @TenantAuthorized('tenant.manage')
  createClient(@Body() body: unknown) {
    return this.integrations.createClient(body);
  }

  @Post('clients/:clientId/revoke')
  @TenantAuthorized('tenant.manage')
  revokeClient(@Param('clientId') clientId: string, @Body() body: unknown) {
    return this.integrations.revokeClient(clientId, body);
  }

  @Get('webhooks')
  listWebhooks(@Query('limit') limit?: string) {
    return this.integrations.listWebhooks(limit);
  }

  @Post('webhooks')
  @TenantAuthorized('tenant.manage')
  createWebhook(@Body() body: unknown) {
    return this.integrations.createWebhook(body);
  }

  @Patch('webhooks/:subscriptionId')
  @TenantAuthorized('tenant.manage')
  updateWebhook(@Param('subscriptionId') subscriptionId: string, @Body() body: unknown) {
    return this.integrations.updateWebhook(subscriptionId, body);
  }

  @Get('deliveries')
  listDeliveries(
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('subscriptionId') subscriptionId?: string,
  ) {
    return this.integrations.listDeliveries({ limit, status, clientId, subscriptionId });
  }

  @Get('deliveries/:deliveryId/attempts')
  listAttempts(@Param('deliveryId') deliveryId: string, @Query('limit') limit?: string) {
    return this.integrations.listAttempts(deliveryId, limit);
  }
}
