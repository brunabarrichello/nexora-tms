import { Controller, Get, Param, Patch, Query } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  InAppNotificationsService,
  type InAppNotificationItem,
} from './in-app-notifications.service.js';

@Controller('api/v1/notifications')
@TenantAuthorized('tenant.read')
export class InAppNotificationsController {
  constructor(private readonly notifications: InAppNotificationsService) {}

  @Get()
  list(
    @Query('state') state?: string,
    @Query('module') module?: string,
    @Query('limit') limit?: string,
  ): Promise<readonly InAppNotificationItem[]> {
    return this.notifications.list({ state, module, limit });
  }

  @Get('unread-count')
  async unreadCount(): Promise<{ readonly count: number }> {
    return { count: await this.notifications.unreadCount() };
  }

  @Patch(':notificationId/read')
  markRead(@Param('notificationId') notificationId: string): Promise<InAppNotificationItem> {
    return this.notifications.markRead(notificationId);
  }
}
