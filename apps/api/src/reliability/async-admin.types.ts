export type AsyncOutboxState =
  | 'pending'
  | 'retry_wait'
  | 'leased'
  | 'processed'
  | 'dead_lettered';

export interface AsyncOutboxRecord {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly idempotencyKey: string;
  readonly correlationId: string | null;
  readonly requestId: string | null;
  readonly state: AsyncOutboxState;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly availableAt: string;
  readonly occurredAt: string;
  readonly processedAt: string | null;
  readonly leaseOwner: string | null;
  readonly leaseExpiresAt: string | null;
  readonly lastError: string | null;
  readonly deadLetteredAt: string | null;
  readonly deadLetterReason: string | null;
}

export type AsyncJobState =
  | 'pending'
  | 'running'
  | 'retry_wait'
  | 'succeeded'
  | 'dead_lettered'
  | 'cancelled';

export interface AsyncJobRecord {
  readonly id: string;
  readonly sourceOutboxEventId: string | null;
  readonly jobType: string;
  readonly idempotencyKey: string;
  readonly correlationId: string | null;
  readonly requestId: string | null;
  readonly state: AsyncJobState;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly runAt: string;
  readonly lockedAt: string | null;
  readonly lockedBy: string | null;
  readonly leaseExpiresAt: string | null;
  readonly lastError: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AsyncReprocessResult {
  readonly kind: 'outbox' | 'job';
  readonly id: string;
  readonly requeued: true;
}
