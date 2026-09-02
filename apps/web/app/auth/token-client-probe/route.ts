import { NextResponse } from 'next/server';

function auth0TokenUrl(): string {
  const domain = process.env.AUTH0_DOMAIN?.trim();
  if (!domain) throw new Error('AUTH0_DOMAIN is required');
  const base = domain.startsWith('http://') || domain.startsWith('https://') ? domain : `https://${domain}`;
  return new URL('/oauth/token', base).toString();
}

export async function GET(): Promise<NextResponse> {
  const clientId = process.env.AUTH0_CLIENT_ID?.trim();
  const clientSecret = process.env.AUTH0_CLIENT_SECRET?.trim();
  const appBaseUrl = process.env.APP_BASE_URL?.trim();

  if (!clientId || !clientSecret || !appBaseUrl) {
    return NextResponse.json({ probeReady: false }, { status: 503 });
  }

  const response = await fetch(auth0TokenUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: 'nex70-intentionally-invalid-authorization-code',
      redirect_uri: new URL('/auth/callback', appBaseUrl).toString(),
      code_verifier: 'nex70-intentionally-invalid-code-verifier',
    }),
    cache: 'no-store',
  });

  let providerError: string | undefined;
  try {
    const payload = (await response.json()) as { error?: unknown };
    providerError = typeof payload.error === 'string' ? payload.error : undefined;
  } catch {
    providerError = undefined;
  }

  return NextResponse.json({
    probeReady: true,
    tokenEndpointStatus: response.status,
    providerError: providerError ?? 'unknown',
    clientAuthenticationAccepted: providerError === 'invalid_grant',
  });
}
