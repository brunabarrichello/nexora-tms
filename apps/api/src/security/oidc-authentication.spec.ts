import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { generateKeyPair, SignJWT } from 'jose';

import type { AuthenticatedHttpRequest } from './authenticated-principal.js';
import type { ExternalIdentityService } from './external-identity.service.js';
import { OidcAuthenticationGuard } from './oidc-authentication.guard.js';
import { OidcConfigService } from './oidc-config.service.js';
import type { OidcTokenVerifierService } from './oidc-token-verifier.service.js';
import { verifyOidcJwt } from './oidc-token-verifier.service.js';
import {
  createUuidV7,
  fingerprintExternalSubject,
  type PretenantAuthEvent,
  type PretenantAuthAuditService,
} from './pretenant-auth-audit.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function executionContextFor(request: AuthenticatedHttpRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function verifier(result: { providerKey: string; subject: string }): OidcTokenVerifierService {
  return { verify: async () => result } as unknown as OidcTokenVerifierService;
}

function rejectedVerifier(): OidcTokenVerifierService {
  return {
    verify: async () => {
      throw new UnauthorizedException('Bearer token is invalid or expired');
    },
  } as unknown as OidcTokenVerifierService;
}

function identities(userId?: string): ExternalIdentityService {
  return { resolveActiveUser: async () => userId } as unknown as ExternalIdentityService;
}

function audit(events: PretenantAuthEvent[]): PretenantAuthAuditService {
  return {
    record: async (event: PretenantAuthEvent) => {
      events.push(event);
    },
  } as unknown as PretenantAuthAuditService;
}

test('OIDC guard rejects requests without a bearer token and audits without token data', async () => {
  const events: PretenantAuthEvent[] = [];
  const guard = new OidcAuthenticationGuard(
    verifier({ providerKey: 'test-idp', subject: 'subject-1' }),
    identities(USER_ID),
    audit(events),
  );

  await assert.rejects(
    guard.canActivate(
      executionContextFor({ headers: { 'x-request-id': 'request-1' } }),
    ),
    (error: unknown) => error instanceof UnauthorizedException,
  );
  assert.deepEqual(events, [
    {
      eventType: 'auth.bearer.missing',
      outcome: 'denied',
      requestId: 'request-1',
      correlationId: undefined,
    },
  ]);
});

test('OIDC guard audits rejected bearer tokens without persisting the bearer value', async () => {
  const events: PretenantAuthEvent[] = [];
  const guard = new OidcAuthenticationGuard(
    rejectedVerifier(),
    identities(USER_ID),
    audit(events),
  );

  await assert.rejects(
    guard.canActivate(
      executionContextFor({
        headers: { authorization: 'Bearer do-not-persist-this-token' },
      }),
    ),
    (error: unknown) => error instanceof UnauthorizedException,
  );
  assert.deepEqual(events, [
    {
      eventType: 'auth.bearer.rejected',
      outcome: 'denied',
      requestId: undefined,
      correlationId: undefined,
    },
  ]);
  assert.equal(JSON.stringify(events).includes('do-not-persist-this-token'), false);
});

test('OIDC guard maps a verified identity to the trusted internal principal and audits success', async () => {
  const events: PretenantAuthEvent[] = [];
  const request: AuthenticatedHttpRequest = {
    headers: { authorization: 'Bearer signed-token' },
  };
  const guard = new OidcAuthenticationGuard(
    verifier({ providerKey: 'test-idp', subject: 'subject-1' }),
    identities(USER_ID),
    audit(events),
  );

  assert.equal(await guard.canActivate(executionContextFor(request)), true);
  assert.deepEqual(request.authenticatedPrincipal, {
    subject: 'test-idp|subject-1',
    userId: USER_ID,
  });
  assert.equal(events[0]?.eventType, 'auth.identity.accepted');
  assert.equal(events[0]?.userId, USER_ID);
});

test('OIDC guard rejects and audits verified identities not linked to an active user', async () => {
  const events: PretenantAuthEvent[] = [];
  const guard = new OidcAuthenticationGuard(
    verifier({ providerKey: 'test-idp', subject: 'unknown-subject' }),
    identities(undefined),
    audit(events),
  );

  await assert.rejects(
    guard.canActivate(
      executionContextFor({ headers: { authorization: 'Bearer signed-token' } }),
    ),
    (error: unknown) => error instanceof UnauthorizedException,
  );
  assert.equal(events[0]?.eventType, 'auth.identity.unlinked');
});

test('pre-tenant auth identifiers are UUIDv7 and subjects are one-way fingerprinted', () => {
  const id = createUuidV7(1_788_218_700_000);
  assert.match(
    id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );

  const fingerprint = fingerprintExternalSubject('auth0', 'private-subject');
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(fingerprint.includes('private-subject'), false);
});

test('OIDC configuration preserves the canonical issuer including a trailing slash', () => {
  const names = [
    'OIDC_PROVIDER_KEY',
    'OIDC_ISSUER_URL',
    'OIDC_JWKS_URL',
    'OIDC_AUDIENCE',
    'OIDC_ALLOWED_ALGORITHMS',
  ] as const;
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]])) as Record<
    (typeof names)[number],
    string | undefined
  >;

  try {
    process.env.OIDC_PROVIDER_KEY = 'auth0';
    process.env.OIDC_ISSUER_URL = 'https://nexora-dev.us.auth0.com/';
    process.env.OIDC_JWKS_URL = 'https://nexora-dev.us.auth0.com/.well-known/jwks.json';
    process.env.OIDC_AUDIENCE = 'urn:nexora:tms:api:development';
    process.env.OIDC_ALLOWED_ALGORITHMS = 'RS256';

    const config = new OidcConfigService().require();
    assert.equal(config.issuer, 'https://nexora-dev.us.auth0.com/');
    assert.equal(
      config.jwksUrl.toString(),
      'https://nexora-dev.us.auth0.com/.well-known/jwks.json',
    );
    assert.deepEqual(config.audience, ['urn:nexora:tms:api:development']);
    assert.deepEqual(config.algorithms, ['RS256']);
  } finally {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test('OIDC JWT verification enforces signature, exact issuer and audience', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const issuer = 'https://nexora-dev.us.auth0.com/';
  const audience = 'urn:nexora:tms:api:development';
  const token = await new SignJWT({ scope: 'nexora:api' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject('external-user-123')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  const subject = await verifyOidcJwt(token, publicKey, {
    algorithms: ['RS256'],
    audience: [audience],
    issuer,
  });
  assert.equal(subject, 'external-user-123');

  await assert.rejects(
    verifyOidcJwt(token, publicKey, {
      algorithms: ['RS256'],
      audience: ['different-api'],
      issuer,
    }),
  );

  await assert.rejects(
    verifyOidcJwt(token, publicKey, {
      algorithms: ['RS256'],
      audience: [audience],
      issuer: issuer.replace(/\/$/, ''),
    }),
  );
});
