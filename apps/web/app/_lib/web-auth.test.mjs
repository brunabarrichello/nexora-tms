import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAuthorizationUrl,
  createAuthTransaction,
  createWebSession,
  isWebSessionActive,
  openAuthValue,
  safeReturnTo,
  sealAuthValue,
  transactionStateMatches,
} from './web-auth.ts';

const config = {
  auth0Domain: new URL('https://tenant.example.auth0.com'),
  clientId: 'client-id',
  clientSecret: 'client-secret',
  sessionSecret: '11'.repeat(32),
  appBaseUrl: new URL('https://web.example.com'),
  apiBaseUrl: new URL('https://api.example.com'),
  apiAudience: 'urn:nexora:tms:api:test',
};

test('authorization URL binds state, API audience and PKCE S256', () => {
  const transaction = createAuthTransaction('/cargas', 1_000);
  const url = buildAuthorizationUrl(config, transaction);

  assert.equal(url.origin, 'https://tenant.example.auth0.com');
  assert.equal(url.pathname, '/authorize');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('client_id'), 'client-id');
  assert.equal(url.searchParams.get('audience'), 'urn:nexora:tms:api:test');
  assert.equal(url.searchParams.get('state'), transaction.state);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.notEqual(url.searchParams.get('code_challenge'), transaction.codeVerifier);
  assert.equal(transaction.returnTo, '/cargas');
});

test('state comparison fails closed for mismatch and expired transaction', () => {
  const transaction = createAuthTransaction('/', 10_000);
  assert.equal(transactionStateMatches(transaction, transaction.state, 11_000), true);
  assert.equal(transactionStateMatches(transaction, `${transaction.state}x`, 11_000), false);
  assert.equal(
    transactionStateMatches(transaction, transaction.state, transaction.expiresAt),
    false,
  );
});

test('sealed values decrypt only with integrity intact', () => {
  const secret = '22'.repeat(32);
  const sealed = sealAuthValue({ value: 'safe' }, secret);
  assert.deepEqual(openAuthValue(sealed, secret), { value: 'safe' });
  assert.equal(openAuthValue(`${sealed}tampered`, secret), undefined);
  assert.equal(openAuthValue(sealed, '33'.repeat(32)), undefined);
});

test('web session becomes inactive at expiry and never stores refresh credentials', () => {
  const session = createWebSession('access-token', 120, 'user-1', 1_000);
  assert.deepEqual(Object.keys(session).sort(), ['accessToken', 'expiresAt', 'userId']);
  assert.equal(isWebSessionActive(session, session.expiresAt - 1), true);
  assert.equal(isWebSessionActive(session, session.expiresAt), false);
});

test('returnTo accepts only same-origin relative application paths', () => {
  assert.equal(safeReturnTo('/viagens?tab=tracking'), '/viagens?tab=tracking');
  assert.equal(safeReturnTo('https://evil.example/path'), '/');
  assert.equal(safeReturnTo('//evil.example/path'), '/');
  assert.equal(safeReturnTo('javascript:alert(1)'), '/');
});
