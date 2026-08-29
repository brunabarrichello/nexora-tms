import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { UnauthorizedException } from '@nestjs/common';

import type { AuthenticatedHttpRequest } from './authenticated-principal.js';
import { AuthController } from './auth.controller.js';

test('authenticated probe returns the linked Nexora user id', () => {
  const controller = new AuthController();
  const request: AuthenticatedHttpRequest = {
    headers: {},
    authenticatedPrincipal: {
      subject: 'auth0|subject-123',
      userId: '11111111-1111-1111-1111-111111111111',
    },
  };

  assert.deepEqual(controller.getAuthenticatedUser(request), {
    authenticated: true,
    userId: '11111111-1111-1111-1111-111111111111',
  });
});

test('authenticated probe rejects a request without an attached principal', () => {
  const controller = new AuthController();
  const request: AuthenticatedHttpRequest = { headers: {} };

  assert.throws(() => controller.getAuthenticatedUser(request), UnauthorizedException);
});
