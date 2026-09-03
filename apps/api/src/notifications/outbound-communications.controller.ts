import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { OutboundCommunicationsService } from './outbound-communications.service.js';

@Controller('api/v1/notifications/outbound')
@TenantAuthorized('notifications.read')
export class OutboundCommunicationsController {
  constructor(private readonly communications: OutboundCommunicationsService) {}

  @Get('provider-routes')
  listProviderRoutes() {
    return this.communications.listProviderRoutes();
  }

  @Put('provider-routes/:channel')
  @TenantAuthorized('notifications.write')
  upsertProviderRoute(@Param('channel') channel: string, @Body() body: unknown) {
    return this.communications.upsertProviderRoute(channel, body);
  }

  @Get('templates')
  listTemplates(@Query('channel') channel?: string, @Query('limit') limit?: string) {
    return this.communications.listTemplates({ channel, limit });
  }

  @Post('templates')
  @TenantAuthorized('notifications.write')
  createTemplate(@Body() body: unknown) {
    return this.communications.createTemplate(body);
  }

  @Post('templates/:templateId/status')
  @TenantAuthorized('notifications.write')
  setTemplateStatus(@Param('templateId') templateId: string, @Body() body: unknown) {
    return this.communications.setTemplateStatus(templateId, body);
  }

  @Get('preferences')
  listPreferences(
    @Query('recipientType') recipientType?: string,
    @Query('recipientId') recipientId?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communications.listPreferences({ recipientType, recipientId, channel, limit });
  }

  @Put('preferences')
  @TenantAuthorized('notifications.write')
  upsertPreference(@Body() body: unknown) {
    return this.communications.upsertPreference(body);
  }

  @Get('communications')
  listCommunications(
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communications.listCommunications({ status, channel, limit });
  }

  @Post('communications')
  @TenantAuthorized('notifications.write')
  queueCommunication(@Body() body: unknown) {
    return this.communications.queueCommunication(body);
  }

  @Get('communications/:communicationId')
  getCommunication(@Param('communicationId') communicationId: string) {
    return this.communications.getCommunication(communicationId);
  }

  @Get('communications/:communicationId/attempts')
  listAttempts(
    @Param('communicationId') communicationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.communications.listAttempts(communicationId, limit);
  }
}
