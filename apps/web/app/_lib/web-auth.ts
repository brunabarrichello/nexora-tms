export interface PasswordRecoveryConfig {
  readonly auth0Domain: URL;
  readonly clientId: string;
  readonly databaseConnection: string;
}

/**
 * Reads only the configuration needed by Auth0's database password recovery API.
 * Login, callback, logout, PKCE and Web sessions are intentionally owned by
 * @auth0/nextjs-auth0 and must not be reimplemented here.
 */
export function readPasswordRecoveryConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PasswordRecoveryConfig {
  const domainValue = requireValue(environment, 'AUTH0_DOMAIN');
  const auth0Domain = new URL(
    domainValue.startsWith('https://') || domainValue.startsWith('http://')
      ? domainValue
      : `https://${domainValue}`,
  );

  if (auth0Domain.protocol !== 'https:' && auth0Domain.hostname !== 'localhost') {
    throw new Error('AUTH0_DOMAIN must use HTTPS');
  }

  return {
    auth0Domain,
    clientId: requireValue(environment, 'AUTH0_CLIENT_ID'),
    databaseConnection: requireValue(environment, 'AUTH0_DATABASE_CONNECTION'),
  };
}

export async function requestPasswordRecovery(
  config: PasswordRecoveryConfig,
  email: string,
): Promise<void> {
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

  // Account enumeration is intentionally prevented. Only provider availability
  // failures become a visible generic error.
  if (response.status >= 500) {
    throw new Error('Auth0 recovery service is unavailable');
  }
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

function requireValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
