import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { readPasswordRecoveryConfig, requestPasswordRecovery, safeReturnTo } from './web-auth.ts';

test('password recovery config normalizes the Auth0 domain and requires the database connection', () => {
  const resolved = readPasswordRecoveryConfig({
    AUTH0_DOMAIN: 'tenant.example.auth0.com',
    AUTH0_CLIENT_ID: 'client-id',
    AUTH0_DATABASE_CONNECTION: 'Username-Password-Authentication',
  });

  assert.equal(resolved.auth0Domain.toString(), 'https://tenant.example.auth0.com/');
  assert.equal(resolved.clientId, 'client-id');
  assert.equal(resolved.databaseConnection, 'Username-Password-Authentication');

  assert.throws(
    () =>
      readPasswordRecoveryConfig({
        AUTH0_DOMAIN: 'tenant.example.auth0.com',
        AUTH0_CLIENT_ID: 'client-id',
      }),
    /AUTH0_DATABASE_CONNECTION is required/,
  );
});

test('password recovery preserves account non-enumeration while failing closed on provider errors', async (t) => {
  const config = {
    auth0Domain: new URL('https://tenant.example.auth0.com'),
    clientId: 'client-id',
    databaseConnection: 'Username-Password-Authentication',
  };

  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => new Response('sent', { status: 200 });
  await assert.doesNotReject(() => requestPasswordRecovery(config, 'user@example.com'));

  // Auth0 documents 404 as "user not found"; keep the same outward behavior to
  // avoid revealing account existence.
  globalThis.fetch = async () => new Response('not found', { status: 404 });
  await assert.doesNotReject(() => requestPasswordRecovery(config, 'missing@example.com'));

  for (const status of [400, 401, 403, 429, 500, 503]) {
    globalThis.fetch = async () => new Response('rejected', { status });
    await assert.rejects(
      () => requestPasswordRecovery(config, 'user@example.com'),
      /Auth0 recovery request was rejected/,
    );
  }
});

test('returnTo accepts only same-origin relative application paths', () => {
  assert.equal(safeReturnTo('/viagens?tab=tracking'), '/viagens?tab=tracking');
  assert.equal(safeReturnTo('https://evil.example/path'), '/');
  assert.equal(safeReturnTo('//evil.example/path'), '/');
  assert.equal(safeReturnTo('javascript:alert(1)'), '/');
});

test('Nexora does not reimplement PKCE, token exchange or Web-session cryptography', async () => {
  const authHelper = await readFile(new URL('./web-auth.ts', import.meta.url), 'utf8');
  const sdkClient = await readFile(new URL('./auth0.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(
    authHelper,
    /codeVerifier|code_challenge|oauth\/token|createCipheriv|createDecipheriv/,
  );
  assert.match(sdkClient, /@auth0\/nextjs-auth0\/server/);
  assert.match(sdkClient, /enableAccessTokenEndpoint:\s*false/);
});

test('logout requires an explicit form submission instead of a prefetchable anchor', async () => {
  const appShell = await readFile(new URL('../_components/app-shell.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(appShell, /<a[^>]*href=["']\/auth\/logout["']/);
  assert.match(appShell, /<form[^>]*action=["']\/auth\/logout["'][^>]*method=["']get["']/);
  assert.match(appShell, /<button[^>]*className=["']button["'][^>]*type=["']submit["']/);
});
