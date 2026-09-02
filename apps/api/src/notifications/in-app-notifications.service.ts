import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';

export type InAppNotificationModule = 'freight' | 'negotiation' | 'trips' | 'documents';
export type InAppNotificationSeverity = 'info' | 'warning' | 'critical';

export interface InAppNotificationItem {
  readonly id: string;
  readonly notificationEventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly module: InAppNotificationModule;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly title: string;
  readonly body: string;
  readonly contextUrl: string;
  readonly severity: InAppNotificationSeverity;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly deliveredAt: string;
  readonly readAt: string | null;
  readonly createdAt: string;
}

interface InboxRow {
  readonly id: string;
  readonly notification_event_id: string;
  readonly event_type: string;
  readonly event_version: number;
  readonly module: InAppNotificationModule;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly title: string;
  readonly body: string;
  readonly context_url: string;
  readonly severity: InAppNotificationSeverity;
  readonly payload: Record<string, unknown>;
  readonly delivered_at: Date;
  readonly read_at: Date | null;
  readonly created_at: Date;
}

const inboxSelect = `
  SELECT
    d.id::text AS id,
    e.id::text AS notification_event_id,
    e.event_type,
    e.event_version,
    e.module,
    e.aggregate_type,
    e.aggregate_id,
    e.title,
    e.body,
    e.context_url,
    e.severity,
    e.payload,
    d.delivered_at,
    d.read_at,
    e.created_at
  FROM in_app_notification_deliveries d
  JOIN in_app_notification_events e
    ON e.tenant_id=d.tenant_id
   AND e.id=d.notification_event_id
`;

@Injectable()
export class InAppNotificationsService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async list(input: {
    readonly state?: string;
    readonly module?: string;
    readonly limit?: string;
  }): Promise<readonly InAppNotificationItem[]> {
    const state = normalizeState(input.state);
    const module = normalizeModule(input.module);
    const limit = normalizeLimit(input.limit);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const filters: string[] = [];
      const values: unknown[] = [];

      if (state === 'unread') filters.push('d.read_at IS NULL');
      if (state === 'read') filters.push('d.read_at IS NOT NULL');
      if (module) {
        values.push(module);
        filters.push(`e.module=$${values.length}`);
      }
      values.push(limit);

      const result = await client.query<InboxRow>(
        `${inboxSelect}
         ${filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''}
         ORDER BY d.delivered_at DESC,d.id DESC
         LIMIT $${values.length}::int`,
        values,
      );
      return result.rows.map(mapInboxRow);
    });
  }

  async unreadCount(): Promise<number> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count
           FROM in_app_notification_deliveries
          WHERE read_at IS NULL`,
      );
      return result.rows[0]?.count ?? 0;
    });
  }

  async markRead(id: string): Promise<InAppNotificationItem> {
    const deliveryId = requireUuid(id, 'notificationId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const updated = await client.query<{ id: string }>(
        `UPDATE in_app_notification_deliveries
            SET read_at=coalesce(read_at,now())
          WHERE id=$1::uuid
          RETURNING id::text AS id`,
        [deliveryId],
      );
      if (!updated.rows[0]) {
        throw new NotFoundException('Notification not found for current user');
      }

      const result = await client.query<InboxRow>(`${inboxSelect} WHERE d.id=$1::uuid`, [
        deliveryId,
      ]);
      const row = result.rows[0];
      if (!row) throw new NotFoundException('Notification not found for current user');
      return mapInboxRow(row);
    });
  }
}

function normalizeState(value: string | undefined): 'all' | 'read' | 'unread' {
  if (!value || value === 'all') return 'all';
  if (value === 'read' || value === 'unread') return value;
  throw new BadRequestException('state must be one of: all, read, unread');
}

function normalizeModule(value: string | undefined): InAppNotificationModule | null {
  if (!value) return null;
  if (['freight', 'negotiation', 'trips', 'documents'].includes(value)) {
    return value as InAppNotificationModule;
  }
  throw new BadRequestException('module must be one of: freight, negotiation, trips, documents');
}

function normalizeLimit(value: string | undefined): number {
  if (!value) return 100;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 200) {
    throw new BadRequestException('limit must be an integer between 1 and 200');
  }
  return parsed;
}

function requireUuid(value: string, field: string): string {
  const normalized = value.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
  ) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return normalized;
}

function mapInboxRow(row: InboxRow): InAppNotificationItem {
  return {
    id: row.id,
    notificationEventId: row.notification_event_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    module: row.module,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    title: row.title,
    body: row.body,
    contextUrl: row.context_url,
    severity: row.severity,
    payload: row.payload,
    deliveredAt: row.delivered_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}
