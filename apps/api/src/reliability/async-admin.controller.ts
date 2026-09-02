import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { AsyncAdminService } from './async-admin.service.js';
import type {
  AsyncJobRecord,
  AsyncOutboxRecord,
  AsyncReprocessResult,
} from './async-admin.types.js';

@Controller('api/v1/admin/async')
@TenantAuthorized('audit.read')
export class AsyncAdminController {
  constructor(private readonly asyncAdmin: AsyncAdminService) {}

  @Get('outbox')
  listOutbox(
    @Query('state') state?: string,
    @Query('eventType') eventType?: string,
    @Query('limit') limit?: string,
  ): Promise<readonly AsyncOutboxRecord[]> {
    return this.asyncAdmin.listOutbox({ state, eventType, limit });
  }

  @Get('jobs')
  listJobs(
    @Query('state') state?: string,
    @Query('jobType') jobType?: string,
    @Query('limit') limit?: string,
  ): Promise<readonly AsyncJobRecord[]> {
    return this.asyncAdmin.listJobs({ state, jobType, limit });
  }

  @Post('outbox/:eventId/reprocess')
  @TenantAuthorized('tenant.manage')
  reprocessOutbox(
    @Param('eventId') eventId: string,
    @Body() body: unknown,
  ): Promise<AsyncReprocessResult> {
    return this.asyncAdmin.reprocessOutbox(eventId, body);
  }

  @Post('jobs/:jobId/reprocess')
  @TenantAuthorized('tenant.manage')
  reprocessJob(
    @Param('jobId') jobId: string,
    @Body() body: unknown,
  ): Promise<AsyncReprocessResult> {
    return this.asyncAdmin.reprocessJob(jobId, body);
  }
}
