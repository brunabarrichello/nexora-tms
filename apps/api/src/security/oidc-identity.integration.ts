import { strict as assert } from 'node:assert';

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import type { AuthenticatedHttpRequest } from './authenticated-principal.js';
import { ExternalIdentityService } from './external-identity.service.js';
import { OidcAuthenticationGuard } from './oidc-authentication.guard.js';
import type { OidcTokenVerifierService } from './oidc-token-verifier.service.js';

const ACTIVE_USER_ID = '52000000-0000-4000-8000-000000000101';
const PROVIDER_KEY = 'ci-oidc';

function executionContextFor(
  request: AuthenticatedHttpRequest,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function verifier(subject: string): OidcTokenVerifierService {
  return {
    verify: async () => ({ providerKey: PROVIDER_KEY, subject }),
  } as unknown as OidcTokenVerifierService;
}

async function run(): Promise<void> {
  const identities = new ExternalIdentityService();

  try {
    assert.equal(
      await identities.resolveActiveUser(PROVIDER_KEY, 'subject-active'),
      ACTIVE_USER_ID,
      'active external identity must resolve to its internal user',
    );
    assert.equal(
      await identities.resolveActiveUser(PROVIDER_KEY, 'subject-missing'),
      undefined,
      'unknown external identity must not resolve',
    );
    assert.equal(
      await identities.resolveActiveUser(PROVIDER_KEY, 'subject-suspended'),
      undefined,
      'external identity linked to a suspended user must not resolve',
    );

    const request: AuthenticatedHttpRequest = {
      headers: { authorization: 'Bearer integration-token' },
    };
    const guard = new OidcAuthenticationGuard(
      verifier('subject-active'),
      identities,
    );

    assert.equal(await guard.canActivate(executionContextFor(request)), true);
    assert.deepEqual(request.authenticatedPrincipal, {
      subject: 'ci-oidc|subject-active',
      userId: ACTIVE_USER_ID,
    });

    const suspendedGuard = new OidcAuthenticationGuard(
      verifier('subject-suspended'),
      identities,
    );
    await assert.rejects(
      suspendedGuard.canActivate(
        executionContextFor({
          headers: { authorization: 'Bearer integration-token' },
        }),
      ),
      (error: unknown) => error instanceof UnauthorizedException,
      'a verified OIDC subject linked only to a suspended user must be rejected',
    );
  } finally {
    await identities.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
