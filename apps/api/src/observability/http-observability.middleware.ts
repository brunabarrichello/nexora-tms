import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export type ObservableRequest = IncomingMessage & {
  originalUrl?: string;
};

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function resolveCorrelationId(request: ObservableRequest): string {
  const incoming = firstHeaderValue(request.headers['x-correlation-id'])?.trim();
  return incoming && CORRELATION_ID_PATTERN.test(incoming) ? incoming : randomUUID();
}

function resolvePath(request: ObservableRequest): string {
  const raw = request.originalUrl ?? request.url ?? '/';
  try {
    return new URL(raw, 'http://nexora.internal').pathname;
  } catch {
    return '/';
  }
}

export function httpObservabilityMiddleware(
  request: ObservableRequest,
  response: ServerResponse,
  next: () => void,
): void {
  const startedAt = process.hrtime.bigint();
  const correlationId = resolveCorrelationId(request);

  response.setHeader('x-correlation-id', correlationId);
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader(
    'permissions-policy',
    'camera=(), microphone=(), geolocation=()',
  );
  response.setHeader('cross-origin-resource-policy', 'same-site');

  if (
    process.env.APP_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  ) {
    response.setHeader(
      'strict-transport-security',
      'max-age=31536000; includeSubDomains',
    );
  }

  response.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const level =
      response.statusCode >= 500 ? 'error' : response.statusCode >= 400 ? 'warn' : 'info';

    process.stdout.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        event: 'http_request',
        service: process.env.APP_NAME ?? 'nexora-tms-api',
        environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'unknown',
        correlationId,
        method: request.method ?? 'UNKNOWN',
        path: resolvePath(request),
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      })}\n`,
    );
  });

  next();
}
