import {
  createCommunicationDeliveryHandler,
  type CommunicationDeliveryDependencies,
} from './communication-delivery.js';
import type { StructuredLogger } from './logger.js';
import type { DurableJobWorkItem, OutboxWorkItem } from './store.js';
import {
  createWebhookDeliveryHandler,
  type WebhookDeliveryDependencies,
} from './webhook-delivery.js';

export interface HandlerContext {
  tenantId: string;
  payload: unknown;
  correlationId: string | null;
  requestId: string | null;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  signal: AbortSignal;
}

export type WorkHandler = (context: HandlerContext) => Promise<void>;

export class MissingHandlerError extends Error {
  constructor(kind: 'outbox' | 'job', type: string) {
    super(`No ${kind} handler registered for ${type}`);
    this.name = 'MissingHandlerError';
  }
}

export class HandlerRegistry {
  private readonly outboxHandlers = new Map<string, WorkHandler>();
  private readonly jobHandlers = new Map<string, WorkHandler>();

  registerOutbox(eventType: string, handler: WorkHandler): this {
    this.outboxHandlers.set(eventType, handler);
    return this;
  }

  registerJob(jobType: string, handler: WorkHandler): this {
    this.jobHandlers.set(jobType, handler);
    return this;
  }

  resolveOutbox(item: OutboxWorkItem): WorkHandler {
    const handler = this.outboxHandlers.get(item.event_type);
    if (!handler) {
      throw new MissingHandlerError('outbox', item.event_type);
    }
    return handler;
  }

  resolveJob(item: DurableJobWorkItem): WorkHandler {
    const handler = this.jobHandlers.get(item.job_type);
    if (!handler) {
      throw new MissingHandlerError('job', item.job_type);
    }
    return handler;
  }
}

const IN_APP_NOTIFICATION_EVENT_TYPES = [
  'freight.transport_request.created',
  'negotiation.transport_contract.confirmed',
  'trips.status.changed',
  'documents.validation.recorded',
] as const;

export function createDefaultHandlerRegistry(
  logger: StructuredLogger,
  webhookDependencies?: WebhookDeliveryDependencies,
  communicationDependencies?: CommunicationDeliveryDependencies,
): HandlerRegistry {
  const registry = new HandlerRegistry();
  const smokeHandler: WorkHandler = async (context) => {
    context.signal.throwIfAborted();
    logger.info('worker.smoke.processed', {
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey,
      attempt: context.attempt,
    });
  };

  const inAppNotificationHandler: WorkHandler = async (context) => {
    context.signal.throwIfAborted();
    const payload = requireInAppNotificationPayload(context.payload);
    logger.info('worker.in_app_notification.acknowledged', {
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey,
      attempt: context.attempt,
      module: payload.module,
      contextUrl: payload.contextUrl,
    });
  };

  const outboundCommunicationQueuedHandler: WorkHandler = async (context) => {
    context.signal.throwIfAborted();
    const communicationId = requireCommunicationId(context.payload);
    logger.info('worker.outbound_communication.queued_acknowledged', {
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey,
      attempt: context.attempt,
      communicationId,
    });
  };

  registry.registerOutbox('nexora.worker.smoke', smokeHandler);
  registry.registerJob('nexora.worker.smoke', smokeHandler);
  for (const eventType of IN_APP_NOTIFICATION_EVENT_TYPES) {
    registry.registerOutbox(eventType, inAppNotificationHandler);
  }
  registry.registerOutbox('notifications.communication.queued', outboundCommunicationQueuedHandler);
  if (webhookDependencies) {
    registry.registerJob(
      'integrations.webhook.deliver',
      createWebhookDeliveryHandler(webhookDependencies),
    );
  }
  if (communicationDependencies) {
    registry.registerJob(
      'notifications.communication.deliver',
      createCommunicationDeliveryHandler(communicationDependencies),
    );
  }
  return registry;
}

function requireInAppNotificationPayload(payload: unknown): {
  readonly module: string;
  readonly contextUrl: string;
} {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('In-app notification payload must be an object');
  }

  const record = payload as Record<string, unknown>;
  if (record.channel !== 'in_app') {
    throw new Error('In-app notification outbox payload must declare channel=in_app');
  }
  if (typeof record.module !== 'string' || record.module.trim().length === 0) {
    throw new Error('In-app notification payload must include module');
  }
  if (
    typeof record.contextUrl !== 'string' ||
    !record.contextUrl.startsWith('/') ||
    record.contextUrl.startsWith('//')
  ) {
    throw new Error('In-app notification payload must include an internal contextUrl');
  }

  return {
    module: record.module,
    contextUrl: record.contextUrl,
  };
}

function requireCommunicationId(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Outbound communication payload must be an object');
  }
  const communicationId = (payload as Record<string, unknown>).communicationId;
  if (
    typeof communicationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      communicationId,
    )
  ) {
    throw new Error('Outbound communication payload requires communicationId UUID');
  }
  return communicationId;
}
