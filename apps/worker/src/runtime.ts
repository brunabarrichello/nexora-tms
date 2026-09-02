import type { WorkerConfig } from './config.js';
import { errorFields, type StructuredLogger } from './logger.js';
import type { HandlerContext, HandlerRegistry } from './handlers.js';
import type { AsyncStore, DurableJobWorkItem, FailureStatus, OutboxWorkItem } from './store.js';

export interface WorkerSnapshot {
  running: boolean;
  ready: boolean;
  startedAt: string | null;
  lastSuccessfulPollAt: string | null;
  lastPollErrorAt: string | null;
  consecutivePollFailures: number;
  claimedOutbox: number;
  claimedJobs: number;
  completed: number;
  failed: number;
  deadLettered: number;
  reapedOutbox: number;
  reapedJobs: number;
}

export class WorkerRuntime {
  private running = false;
  private loopPromise: Promise<void> | null = null;
  private startedAt: number | null = null;
  private lastSuccessfulPollAt: number | null = null;
  private lastPollErrorAt: number | null = null;
  private consecutivePollFailures = 0;
  private nextReaperAt = 0;
  private claimedOutbox = 0;
  private claimedJobs = 0;
  private completed = 0;
  private failed = 0;
  private deadLettered = 0;
  private reapedOutbox = 0;
  private reapedJobs = 0;

  constructor(
    private readonly config: WorkerConfig,
    private readonly store: AsyncStore,
    private readonly handlers: HandlerRegistry,
    private readonly logger: StructuredLogger,
  ) {}

  async start(): Promise<{ role: string; database: string }> {
    if (this.running) {
      throw new Error('Worker runtime is already running');
    }

    const identity = await this.store.connect();
    this.running = true;
    this.startedAt = Date.now();
    this.nextReaperAt = 0;
    this.loopPromise = this.loop();

    this.logger.info('worker.runtime.started', {
      databaseRole: identity.role,
      database: identity.database,
      pollIntervalMs: this.config.pollIntervalMs,
      batchSize: this.config.batchSize,
      leaseSeconds: this.config.leaseSeconds,
      maxConcurrency: this.config.maxConcurrency,
    });

    return identity;
  }

  async stop(): Promise<void> {
    if (!this.running) {
      await this.store.close();
      return;
    }

    this.running = false;
    await this.loopPromise;
    this.loopPromise = null;
    await this.store.close();
    this.logger.info('worker.runtime.stopped');
  }

  snapshot(now = Date.now()): WorkerSnapshot {
    const ready =
      this.running &&
      this.lastSuccessfulPollAt !== null &&
      now - this.lastSuccessfulPollAt <= this.config.readinessStaleAfterMs;

    return {
      running: this.running,
      ready,
      startedAt: this.startedAt === null ? null : new Date(this.startedAt).toISOString(),
      lastSuccessfulPollAt:
        this.lastSuccessfulPollAt === null
          ? null
          : new Date(this.lastSuccessfulPollAt).toISOString(),
      lastPollErrorAt:
        this.lastPollErrorAt === null ? null : new Date(this.lastPollErrorAt).toISOString(),
      consecutivePollFailures: this.consecutivePollFailures,
      claimedOutbox: this.claimedOutbox,
      claimedJobs: this.claimedJobs,
      completed: this.completed,
      failed: this.failed,
      deadLettered: this.deadLettered,
      reapedOutbox: this.reapedOutbox,
      reapedJobs: this.reapedJobs,
    };
  }

  private async loop(): Promise<void> {
    while (this.running) {
      const started = Date.now();
      try {
        await this.tick(started);
        this.lastSuccessfulPollAt = Date.now();
        this.consecutivePollFailures = 0;
      } catch (error) {
        this.lastPollErrorAt = Date.now();
        this.consecutivePollFailures += 1;
        this.logger.error('worker.poll.failed', {
          ...errorFields(error),
          consecutivePollFailures: this.consecutivePollFailures,
        });
      }

      const elapsed = Date.now() - started;
      await this.delay(Math.max(0, this.config.pollIntervalMs - elapsed));
    }
  }

  private async tick(now: number): Promise<void> {
    if (now >= this.nextReaperAt) {
      const reaped = await this.store.reapExpiredLeases(
        this.config.workerId,
        this.config.batchSize,
      );
      this.reapedOutbox += reaped.outbox;
      this.reapedJobs += reaped.jobs;
      this.nextReaperAt = now + this.config.reaperIntervalMs;

      if (reaped.outbox > 0 || reaped.jobs > 0) {
        this.logger.warn('worker.leases.reaped', reaped);
      }
    }

    const [outboxItems, jobItems] = await Promise.all([
      this.store.claimOutbox(this.config.workerId, this.config.batchSize, this.config.leaseSeconds),
      this.store.claimJobs(this.config.workerId, this.config.batchSize, this.config.leaseSeconds),
    ]);

    this.claimedOutbox += outboxItems.length;
    this.claimedJobs += jobItems.length;

    await Promise.all([
      this.processWithConcurrency(outboxItems, (item) => this.processOutbox(item)),
      this.processWithConcurrency(jobItems, (item) => this.processJob(item)),
    ]);
  }

  private async processOutbox(item: OutboxWorkItem): Promise<void> {
    const common = {
      kind: 'outbox',
      workId: item.id,
      tenantId: item.tenant_id,
      workType: item.event_type,
      correlationId: item.correlation_id,
      requestId: item.request_id,
      idempotencyKey: item.idempotency_key,
      attempt: item.attempts,
      maxAttempts: item.max_attempts,
    };

    try {
      const handler = this.handlers.resolveOutbox(item);
      await handler(this.outboxContext(item));
      const completed = await this.store.completeOutbox(item.id, this.config.workerId);
      if (!completed) {
        this.logger.warn('worker.completion.lease_lost', common);
        return;
      }

      this.completed += 1;
      this.logger.info('worker.work.completed', common);
    } catch (error) {
      await this.recordOutboxFailure(item, error, common);
    }
  }

  private async processJob(item: DurableJobWorkItem): Promise<void> {
    const common = {
      kind: 'job',
      workId: item.id,
      tenantId: item.tenant_id,
      workType: item.job_type,
      correlationId: item.correlation_id,
      requestId: item.request_id,
      idempotencyKey: item.idempotency_key,
      attempt: item.attempt,
      maxAttempts: item.max_attempts,
    };

    try {
      const handler = this.handlers.resolveJob(item);
      await handler(this.jobContext(item));
      const completed = await this.store.completeJob(item.id, this.config.workerId);
      if (!completed) {
        this.logger.warn('worker.completion.lease_lost', common);
        return;
      }

      this.completed += 1;
      this.logger.info('worker.work.completed', common);
    } catch (error) {
      await this.recordJobFailure(item, error, common);
    }
  }

  private async recordOutboxFailure(
    item: OutboxWorkItem,
    error: unknown,
    common: Record<string, unknown>,
  ): Promise<void> {
    const status = await this.store.failOutbox(
      item.id,
      this.config.workerId,
      this.failureMessage(error),
      this.config.baseBackoffSeconds,
      this.config.maxBackoffSeconds,
    );
    this.recordFailure(status, error, common);
  }

  private async recordJobFailure(
    item: DurableJobWorkItem,
    error: unknown,
    common: Record<string, unknown>,
  ): Promise<void> {
    const status = await this.store.failJob(
      item.id,
      this.config.workerId,
      this.failureMessage(error),
      this.config.baseBackoffSeconds,
      this.config.maxBackoffSeconds,
    );
    this.recordFailure(status, error, common);
  }

  private recordFailure(
    status: FailureStatus,
    error: unknown,
    common: Record<string, unknown>,
  ): void {
    if (status === null) {
      this.logger.warn('worker.failure.lease_lost', { ...common, ...errorFields(error) });
      return;
    }

    this.failed += 1;
    if (status === 'dead_lettered') {
      this.deadLettered += 1;
    }

    this.logger.warn('worker.work.failed', {
      ...common,
      ...errorFields(error),
      status,
    });
  }

  private outboxContext(item: OutboxWorkItem): HandlerContext {
    return {
      tenantId: item.tenant_id,
      payload: item.payload,
      correlationId: item.correlation_id,
      requestId: item.request_id,
      idempotencyKey: item.idempotency_key,
      attempt: item.attempts,
      maxAttempts: item.max_attempts,
    };
  }

  private jobContext(item: DurableJobWorkItem): HandlerContext {
    return {
      tenantId: item.tenant_id,
      payload: item.payload,
      correlationId: item.correlation_id,
      requestId: item.request_id,
      idempotencyKey: item.idempotency_key,
      attempt: item.attempt,
      maxAttempts: item.max_attempts,
    };
  }

  private async processWithConcurrency<T>(
    items: T[],
    processItem: (item: T) => Promise<void>,
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    let cursor = 0;
    const workerCount = Math.min(this.config.maxConcurrency, items.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (this.running) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) {
          return;
        }
        await processItem(items[index] as T);
      }
    });

    await Promise.all(workers);
  }

  private failureMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, 3_500);
  }

  private async delay(milliseconds: number): Promise<void> {
    if (!this.running || milliseconds <= 0) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  }
}
