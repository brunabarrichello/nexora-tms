import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { readPasswordRecoveryConfig, safeReturnTo } from './web-auth.ts';

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

test('returnTo accepts only same-origin relative application paths', () => {
  assert.equal(safeReturnTo('/viagens?tab=tracking'), '/viagens?tab=tracking');
  assert.equal(safeReturnTo('https://evil.example/path'), '/');
  assert.equal(safeReturnTo('//evil.example/path'), '/');
  assert.equal(safeReturnTo('javascript:alert(1)'), '/');
});

test('Nexora does not reimplement PKCE, token exchange or Web-session cryptography', async () => {
  const authHelper = await readFile(new URL('./web-auth.ts', import.meta.url), 'utf8');
  const sdkClient = await readFile(new URL('./auth0.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(authHelper, /codeVerifier|code_challenge|oauth\/token|createCipheriv|createDecipheriv/);
  assert.match(sdkClient, /@auth0\/nextjs-auth0\/server/);
  assert.match(sdkClient, /enableAccessTokenEndpoint:\s*false/);
});
