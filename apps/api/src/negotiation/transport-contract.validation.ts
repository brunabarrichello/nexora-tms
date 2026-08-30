import { BadRequestException } from '@nestjs/common';

export interface TransportContractReasonInput {
  readonly reason: string;
}

export function parseTransportContractReason(input: unknown): TransportContractReasonInput {
  if (!isRecord(input)) {
    throw new BadRequestException('Request body must be an object');
  }

  const rawReason = input.reason;
  if (typeof rawReason !== 'string') {
    throw new BadRequestException('reason is required');
  }

  const reason = rawReason.trim();
  if (reason.length === 0) {
    throw new BadRequestException('reason is required');
  }
  if (reason.length > 1000) {
    throw new BadRequestException('reason must not exceed 1000 characters');
  }

  return { reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
