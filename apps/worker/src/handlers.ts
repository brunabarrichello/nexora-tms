import type { DurableJobWorkItem, OutboxWorkItem } from './store.js';
import type { StructuredLogger } from './logger.js';

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

export function createDefaultHandlerRegistry(logger: StructuredLogger): HandlerRegistry {
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

  registry.registerOutbox('nexora.worker.smoke', smokeHandler);
  registry.registerJob('nexora.worker.smoke', smokeHandler);
  return registry;
}
