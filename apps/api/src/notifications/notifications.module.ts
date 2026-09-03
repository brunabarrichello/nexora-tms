import { Module } from '@nestjs/common';

import { AuthenticationModule } from '../security/authentication.module.js';
import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { InAppNotificationsController } from './in-app-notifications.controller.js';
import { InAppNotificationsService } from './in-app-notifications.service.js';
import { OutboundCommunicationsController } from './outbound-communications.controller.js';
import { OutboundCommunicationsService } from './outbound-communications.service.js';

@Module({
  imports: [AuthenticationModule, TenancyModule],
  controllers: [InAppNotificationsController, OutboundCommunicationsController],
  providers: [InAppNotificationsService, OutboundCommunicationsService, TenantRuntimeGateGuard],
  exports: [InAppNotificationsService, OutboundCommunicationsService],
})
export class NotificationsModule {}
