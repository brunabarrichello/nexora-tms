import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { generateKeyPair, SignJWT } from 'jose';

import type { AuthenticatedHttpRequest } from './authenticated-principal.js';
import type { ExternalIdentityService } from './external-identity.service.js';
import { OidcAuthenticationGuard } from './oidc-authentication.guard.js';
import type { OidcTokenVerifierService } from './oidc-token-verifier.service.js';
import { verifyOidcJwt } from './oidc-token-verifier.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function executionContextFor(
  request: AuthenticatedHttpRequest,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function verifier(
  result: { providerKey: string; subject: string },
): OidcTokenVerifierService {
  return {
    verify: async () => result,
  } as unknown as OidcTokenVerifierService;
}

function identities(userId?: string): ExternalIdentityService {
  return {
    resolveActiveUser: async () => userId,
  } as unknown as ExternalIdentityService;
}

test('OIDC guard rejects requests without a bearer token', async () => {
  const guard = new OidcAuthenticationGuard(
    verifier({ providerKey: 'test-idp', subject: 'subject-1' }),
    identities(USER_ID),
  );

  await assert.rejects(
    guard.canActivate(executionContextFor({ headers: {} })),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('OIDC guard maps a verified identity to the trusted internal principal', async () => {
  const request: AuthenticatedHttpRequest = {
    headers: { authorization: 'Bearer signed-token' },
  };
  const guard = new OidcAuthenticationGuard(
    verifier({ providerKey: 'test-idp', subject: 'subject-1' }),
    identities(USER_ID),
  );

  assert.equal(await guard.canActivate(executionContextFor(request)), true);
  assert.deepEqual(request.authenticatedPrincipal, {
    subject: 'test-idp|subject-1',
    userId: USER_ID,
  });
});

test('OIDC guard rejects verified identities that are not linked to an active user', async () => {
  const guard = new OidcAuthenticationGuard(
    verifier({ providerKey: 'test-idp', subject: 'unknown-subject' }),
    identities(undefined),
  );

  await assert.rejects(
    guard.canActivate(
      executionContextFor({
        headers: { authorization: 'Bearer signed-token' },
      }),
    ),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('OIDC JWT verification enforces signature, issuer and audience', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const token = await new SignJWT({ scope: 'nexora:api' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://issuer.example.com')
    .setAudience('nexora-api')
    .setSubject('external-user-123')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  const subject = await verifyOidcJwt(token, publicKey, {
    algorithms: ['RS256'],
    audience: ['nexora-api'],
    issuer: 'https://issuer.example.com',
  });
  assert.equal(subject, 'external-user-123');

  await assert.rejects(
    verifyOidcJwt(token, publicKey, {
      algorithms: ['RS256'],
      audience: ['different-api'],
      issuer: 'https://issuer.example.com',
    }),
  );
});
