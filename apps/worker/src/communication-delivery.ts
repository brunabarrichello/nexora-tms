import { createHash } from 'node:crypto';

import type { HandlerContext, WorkHandler } from './handlers.js';

export type CommunicationChannel = 'email' | 'whatsapp' | 'sms';

export interface CommunicationDeliveryTarget {
  readonly communication_id: string;
  readonly tenant_id: string;
  readonly communication_status: string;
  readonly route_status: string;
  readonly provider_code: string;
  readonly channel: CommunicationChannel;
  readonly destination: string;
  readonly rendered_subject: string | null;
  readonly rendered_body: string;
  readonly idempotency_key: string;
}

export interface CommunicationDeliveryPort {
  getCommunicationDelivery(communicationId: string): Promise<CommunicationDeliveryTarget | null>;
  recordCommunicationAttempt(input: {
    readonly communicationId: string;
    readonly jobAttempt: number;
    readonly outcome: 'success' | 'failure' | 'cancelled';
    readonly providerMessageId: string | null;
    readonly statusCode: number | null;
    readonly durationMs: number;
    readonly errorMessage: string | null;
    readonly terminal: boolean;
  }): Promise<boolean>;
}

export interface CommunicationProviderSendInput {
  readonly tenantId: string;
  readonly channel: CommunicationChannel;
  readonly destination: string;
  readonly subject: string | null;
  readonly body: string;
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
}

export interface CommunicationProviderSendResult {
  readonly providerMessageId: string | null;
  readonly statusCode: number | null;
}

export interface CommunicationProvider {
  readonly code: string;
  readonly channels: readonly CommunicationChannel[];
  send(input: CommunicationProviderSendInput): Promise<CommunicationProviderSendResult>;
}

export class CommunicationProviderRegistry {
  private readonly providers = new Map<string, CommunicationProvider>();

  register(provider: CommunicationProvider): this {
    this.providers.set(provider.code, provider);
    return this;
  }

  resolve(providerCode: string, channel: CommunicationChannel): CommunicationProvider {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      throw new Error(`Communication provider is not registered: ${providerCode}`);
    }
    if (!provider.channels.includes(channel)) {
      throw new Error(`Communication provider ${providerCode} does not support channel ${channel}`);
    }
    return provider;
  }
}

export interface CommunicationDeliveryDependencies {
  readonly port: CommunicationDeliveryPort;
  readonly providers: CommunicationProviderRegistry;
}

export function createCommunicationDeliveryHandler(
  dependencies: CommunicationDeliveryDependencies,
): WorkHandler {
  return async (context) => {
    context.signal.throwIfAborted();
    const communicationId = requireCommunicationId(context.payload);
    const target = await dependencies.port.getCommunicationDelivery(communicationId);
    if (!target) {
      throw new Error(`Outbound communication not found: ${communicationId}`);
    }

    if (target.communication_status === 'sent' || target.communication_status === 'cancelled') {
      return;
    }
    if (target.communication_status === 'blocked') {
      throw new Error(`Blocked outbound communication reached Worker: ${communicationId}`);
    }

    if (target.route_status !== 'active') {
      await dependencies.port.recordCommunicationAttempt({
        communicationId,
        jobAttempt: context.attempt,
        outcome: 'cancelled',
        providerMessageId: null,
        statusCode: null,
        durationMs: 0,
        errorMessage: 'communication provider route is disabled',
        terminal: true,
      });
      return;
    }

    const provider = dependencies.providers.resolve(target.provider_code, target.channel);
    const startedAt = Date.now();
    try {
      const result = await provider.send({
        tenantId: target.tenant_id,
        channel: target.channel,
        destination: target.destination,
        subject: target.rendered_subject,
        body: target.rendered_body,
        idempotencyKey: target.idempotency_key,
        signal: context.signal,
      });
      const recorded = await dependencies.port.recordCommunicationAttempt({
        communicationId,
        jobAttempt: context.attempt,
        outcome: 'success',
        providerMessageId: result.providerMessageId,
        statusCode: result.statusCode,
        durationMs: Date.now() - startedAt,
        errorMessage: null,
        terminal: true,
      });
      if (!recorded) {
        throw new Error(`Communication success could not be recorded: ${communicationId}`);
      }
    } catch (error) {
      const terminal = context.attempt >= context.maxAttempts;
      await dependencies.port.recordCommunicationAttempt({
        communicationId,
        jobAttempt: context.attempt,
        outcome: 'failure',
        providerMessageId: null,
        statusCode: providerStatusCode(error),
        durationMs: Date.now() - startedAt,
        errorMessage: errorMessage(error),
        terminal,
      });
      throw error;
    }
  };
}

export class DeterministicCommunicationProvider implements CommunicationProvider {
  readonly code = 'deterministic';
  readonly channels = ['email', 'whatsapp', 'sms'] as const;

  async send(input: CommunicationProviderSendInput): Promise<CommunicationProviderSendResult> {
    input.signal.throwIfAborted();
    const digest = createHash('sha256')
      .update(`${input.channel}:${input.destination}:${input.idempotencyKey}`)
      .digest('hex')
      .slice(0, 24);
    return { providerMessageId: `det-${digest}`, statusCode: 202 };
  }
}

function requireCommunicationId(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Communication delivery payload must be an object');
  }
  const communicationId = (payload as Record<string, unknown>).communicationId;
  if (
    typeof communicationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      communicationId,
    )
  ) {
    throw new Error('Communication delivery payload requires communicationId UUID');
  }
  return communicationId;
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 2_000);
}

function providerStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const value = (error as { statusCode?: unknown }).statusCode;
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : null;
}
