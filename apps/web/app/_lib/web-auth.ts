import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const WEB_SESSION_COOKIE = 'nexora_web_session';
export const AUTH_TRANSACTION_COOKIE = 'nexora_auth_transaction';
export const AUTH_TRANSACTION_TTL_SECONDS = 10 * 60;

export interface WebAuthConfig {
  readonly auth0Domain: URL;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly sessionSecret: string;
  readonly appBaseUrl: URL;
  readonly apiBaseUrl: URL;
  readonly apiAudience: string;
  readonly databaseConnection?: string;
}

export interface AuthTransaction {
  readonly state: string;
  readonly codeVerifier: string;
  readonly returnTo: string;
  readonly expiresAt: number;
}

export interface WebSession {
  readonly accessToken: string;
  readonly expiresAt: number;
  readonly userId: string;
}

interface TokenResponse {
  readonly access_token?: unknown;
  readonly expires_in?: unknown;
  readonly token_type?: unknown;
}

export function readWebAuthConfig(environment: NodeJS.ProcessEnv = process.env): WebAuthConfig {
  const domainValue =
    optionalValue(environment, 'AUTH0_DOMAIN') ??
    optionalValue(environment, 'OIDC_ISSUER_URL') ??
    requireValue(environment, 'AUTH0_DOMAIN');
  const auth0Domain = new URL(
    domainValue.startsWith('https://') || domainValue.startsWith('http://')
      ? domainValue
      : `https://${domainValue}`,
  );
  if (auth0Domain.protocol !== 'https:' && auth0Domain.hostname !== 'localhost') {
    throw new Error('AUTH0_DOMAIN/OIDC_ISSUER_URL must use HTTPS');
  }

  const appBaseUrl = resolveAppBaseUrl(environment);
  if (appBaseUrl.protocol !== 'https:' && appBaseUrl.hostname !== 'localhost') {
    throw new Error('APP_BASE_URL must use HTTPS outside localhost');
  }

  const apiBaseUrl = new URL(requireValue(environment, 'NEXORA_API_BASE_URL'));
  const sessionSecret = requireValue(environment, 'AUTH0_SECRET');
  if (!/^[0-9a-fA-F]{64}$/.test(sessionSecret)) {
    throw new Error('AUTH0_SECRET must contain exactly 64 hexadecimal characters');
  }

  return {
    auth0Domain,
    clientId: requireValue(environment, 'AUTH0_CLIENT_ID'),
    clientSecret: requireValue(environment, 'AUTH0_CLIENT_SECRET'),
    sessionSecret: sessionSecret.toLowerCase(),
    appBaseUrl,
    apiBaseUrl,
    apiAudience:
      optionalValue(environment, 'NEXORA_API_AUDIENCE') ??
      optionalValue(environment, 'OIDC_AUDIENCE') ??
      requireValue(environment, 'NEXORA_API_AUDIENCE'),
    databaseConnection: optionalValue(environment, 'AUTH0_DATABASE_CONNECTION'),
  };
}

export function createAuthTransaction(returnTo: string, now = Date.now()): AuthTransaction {
  return {
    state: randomBase64Url(32),
    codeVerifier: randomBase64Url(64),
    returnTo: safeReturnTo(returnTo),
    expiresAt: now + AUTH_TRANSACTION_TTL_SECONDS * 1000,
  };
}

export function buildAuthorizationUrl(config: WebAuthConfig, transaction: AuthTransaction): URL {
  const url = new URL('/authorize', config.auth0Domain);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', new URL('/auth/callback', config.appBaseUrl).toString());
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('audience', config.apiAudience);
  url.searchParams.set('state', transaction.state);
  url.searchParams.set('code_challenge', pkceChallenge(transaction.codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return url;
}

export function transactionStateMatches(
  transaction: AuthTransaction,
  suppliedState: string,
  now = Date.now(),
): boolean {
  if (transaction.expiresAt <= now) return false;
  const expected = Buffer.from(transaction.state);
  const supplied = Buffer.from(suppliedState);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export async function exchangeAuthorizationCode(
  config: WebAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch(new URL('/oauth/token', config.auth0Domain), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: new URL('/auth/callback', config.appBaseUrl).toString(),
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Auth0 token exchange failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as TokenResponse;
  if (
    typeof payload.access_token !== 'string' ||
    !payload.access_token ||
    typeof payload.expires_in !== 'number' ||
    !Number.isFinite(payload.expires_in) ||
    payload.expires_in <= 0 ||
    (payload.token_type !== undefined && payload.token_type !== 'Bearer')
  ) {
    throw new Error('Auth0 token response is invalid');
  }

  return { accessToken: payload.access_token, expiresIn: payload.expires_in };
}

export async function resolveNexoraUser(
  config: WebAuthConfig,
  accessToken: string,
): Promise<string> {
  const response = await fetch(new URL('/api/v1/auth/me', config.apiBaseUrl), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Nexora identity resolution failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    authenticated?: unknown;
    userId?: unknown;
  };
  if (payload.authenticated !== true || typeof payload.userId !== 'string' || !payload.userId) {
    throw new Error('Nexora identity response is invalid');
  }
  return payload.userId;
}

export function createWebSession(
  accessToken: string,
  expiresInSeconds: number,
  userId: string,
  now = Date.now(),
): WebSession {
  const safetyWindowMs = Math.min(30_000, Math.max(1_000, expiresInSeconds * 100));
  return {
    accessToken,
    userId,
    expiresAt: now + expiresInSeconds * 1000 - safetyWindowMs,
  };
}

export function isWebSessionActive(session: WebSession, now = Date.now()): boolean {
  return session.expiresAt > now && Boolean(session.accessToken) && Boolean(session.userId);
}

export function buildLogoutUrl(config: WebAuthConfig): URL {
  const url = new URL('/v2/logout', config.auth0Domain);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('returnTo', new URL('/login?logged_out=1', config.appBaseUrl).toString());
  return url;
}

export async function requestPasswordRecovery(config: WebAuthConfig, email: string): Promise<void> {
  if (!config.databaseConnection) {
    throw new Error('AUTH0_DATABASE_CONNECTION is required for password recovery');
  }

  const normalizedEmail = email.trim();
  if (!normalizedEmail || normalizedEmail.length > 254 || !normalizedEmail.includes('@')) {
    return;
  }

  const response = await fetch(new URL('/dbconnections/change_password', config.auth0Domain), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      email: normalizedEmail,
      connection: config.databaseConnection,
    }),
    cache: 'no-store',
  });

  // Do not expose whether an account exists. Provider-side errors are intentionally collapsed.
  if (response.status >= 500) {
    throw new Error('Auth0 recovery service is unavailable');
  }
}

export function sealAuthValue(value: unknown, secretHex: string): string {
  const key = sessionKey(secretHex);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
}

export function openAuthValue<T>(sealed: string | undefined, secretHex: string): T | undefined {
  if (!sealed) return undefined;
  try {
    const [version, ivValue, encryptedValue, tagValue] = sealed.split('.');
    if (version !== 'v1' || !ivValue || !encryptedValue || !tagValue) {
      return undefined;
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      sessionKey(secretHex),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString('utf8')) as T;
  } catch {
    return undefined;
  }
}

export function pkceChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const parsed = new URL(value, 'https://nexora.invalid');
    if (parsed.origin !== 'https://nexora.invalid') return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

function resolveAppBaseUrl(environment: NodeJS.ProcessEnv): URL {
  const explicit = optionalValue(environment, 'APP_BASE_URL');
  if (explicit) return new URL(explicit);

  const vercelHost =
    optionalValue(environment, 'VERCEL_BRANCH_URL') ?? optionalValue(environment, 'VERCEL_URL');
  if (vercelHost) return new URL(`https://${vercelHost}`);

  throw new Error('APP_BASE_URL is required outside Vercel');
}

function randomBase64Url(size: number): string {
  return randomBytes(size).toString('base64url');
}

function sessionKey(secretHex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(secretHex)) {
    throw new Error('Session secret must contain 64 hexadecimal characters');
  }
  return Buffer.from(secretHex, 'hex');
}

function requireValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = optionalValue(environment, name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optionalValue(environment: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = environment[name]?.trim();
  return value || undefined;
}
