import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:https';

import { SignJWT, exportJWK, generateKeyPair } from 'jose';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const issuer = required('OIDC_FIXTURE_ISSUER');
const audience = required('OIDC_FIXTURE_AUDIENCE');
const subject = required('OIDC_FIXTURE_SUBJECT');
const tokenFile = required('OIDC_FIXTURE_TOKEN_FILE');
const certificateFile = required('OIDC_FIXTURE_CERT_FILE');
const privateKeyFile = required('OIDC_FIXTURE_TLS_KEY_FILE');
const port = Number(process.env.OIDC_FIXTURE_PORT ?? 9443);

if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error('OIDC_FIXTURE_PORT must be a valid TCP port');
}

const { publicKey, privateKey } = await generateKeyPair('RS256', {
  modulusLength: 2048,
  extractable: true,
});
const jwk = await exportJWK(publicKey);
jwk.alg = 'RS256';
jwk.kid = 'nexora-ci-e2e-key';
jwk.use = 'sig';

const token = await new SignJWT({ scope: 'openid profile' })
  .setProtectedHeader({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' })
  .setIssuer(issuer)
  .setAudience(audience)
  .setSubject(subject)
  .setIssuedAt()
  .setExpirationTime('10m')
  .sign(privateKey);

await writeFile(tokenFile, `${token}\n`, { mode: 0o600 });

const [cert, key] = await Promise.all([
  readFile(certificateFile),
  readFile(privateKeyFile),
]);

const server = createServer({ cert, key }, (request, response) => {
  if (request.url === '/.well-known/jwks.json') {
    response.writeHead(200, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify({ keys: [jwk] }));
    return;
  }

  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(
    `OIDC CI fixture listening on https://127.0.0.1:${port}\n`,
  );
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
