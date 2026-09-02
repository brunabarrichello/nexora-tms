import type { TenantQueryClient } from '../tenancy/tenant-database.service.js';

export type InAppNotificationModule = 'freight' | 'negotiation' | 'trips' | 'documents';
export type InAppNotificationSeverity = 'info' | 'warning' | 'critical';

export interface InAppNotificationInput {
  readonly eventKey: string;
  readonly eventType: string;
  readonly eventVersion?: number;
  readonly module: InAppNotificationModule;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly title: string;
  readonly body: string;
  readonly contextUrl: string;
  readonly severity?: InAppNotificationSeverity;
  readonly targetRoleCodes: readonly string[];
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface InAppNotificationEmission {
  readonly notificationEventId: string;
  readonly outboxEventId: string;
  readonly deliveryCount: number;
}

interface EmissionRow {
  readonly notification_event_id: string;
  readonly outbox_event_id: string;
  readonly delivery_count: number;
}

export async function emitInAppNotification(
  client: TenantQueryClient,
  input: InAppNotificationInput,
): Promise<InAppNotificationEmission> {
  const result = await client.query<EmissionRow>(
    `SELECT
       notification_event_id::text AS notification_event_id,
       outbox_event_id::text AS outbox_event_id,
       delivery_count
     FROM nexora_emit_in_app_notification(
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text[],$12::jsonb
     )`,
    [
      input.eventKey,
      input.eventType,
      input.eventVersion ?? 1,
      input.module,
      input.aggregateType,
      input.aggregateId,
      input.title,
      input.body,
      input.contextUrl,
      input.severity ?? 'info',
      input.targetRoleCodes,
      JSON.stringify(input.payload ?? {}),
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('In-app notification emission did not return a result');
  }

  return {
    notificationEventId: row.notification_event_id,
    outboxEventId: row.outbox_event_id,
    deliveryCount: row.delivery_count,
  };
}
