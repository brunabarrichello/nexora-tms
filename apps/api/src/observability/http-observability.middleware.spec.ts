import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { test } from 'node:test';

import {
  httpObservabilityMiddleware,
  type ObservableRequest,
} from './http-observability.middleware.js';

class FakeResponse extends EventEmitter {
  statusCode = 200;
  readonly headers = new Map<string, string>();

  setHeader(name: string, value: string | number | readonly string[]): this {
    this.headers.set(name.toLowerCase(), Array.isArray(value) ? value.join(',') : String(value));
    return this;
  }
}

function request(correlationId?: string): ObservableRequest {
  return {
    headers: correlationId ? { 'x-correlation-id': correlationId } : {},
    method: 'GET',
    url: '/health?probe=true',
  } as IncomingMessage & ObservableRequest;
}

test('middleware preserves a valid correlation id and adds security headers', () => {
  const response = new FakeResponse();
  let nextCalled = false;

  httpObservabilityMiddleware(
    request('corr-test-123'),
    response as unknown as ServerResponse,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, true);
  assert.equal(response.headers.get('x-correlation-id'), 'corr-test-123');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-site');
});

test('middleware replaces an unsafe correlation id', () => {
  const response = new FakeResponse();

  httpObservabilityMiddleware(
    request('unsafe correlation id with spaces'),
    response as unknown as ServerResponse,
    () => undefined,
  );

  const generated = response.headers.get('x-correlation-id');
  assert.ok(generated);
  assert.notEqual(generated, 'unsafe correlation id with spaces');
  assert.match(generated, /^[0-9a-f-]{36}$/i);
});
