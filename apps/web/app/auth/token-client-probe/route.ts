import { NextResponse } from 'next/server';

type ProbeResult = {
  status: number;
  providerError: string;
  accepted: boolean;
};

function auth0TokenUrl(): string {
  const domain = process.env.AUTH0_DOMAIN?.trim();
  if (!domain) throw new Error('AUTH0_DOMAIN is required');
  const base =
    domain.startsWith('http://') || domain.startsWith('https://') ? domain : `https://${domain}`;
  return new URL('/oauth/token', base).toString();
}

async function exchangeProbe(
  body: URLSearchParams,
  headers: Record<string, string>,
): Promise<ProbeResult> {
  const response = await fetch(auth0TokenUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body,
    cache: 'no-store',
  });

  let providerError = 'unknown';
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string') providerError = payload.error;
  } catch {}

  return {
    status: response.status,
    providerError,
    accepted: providerError === 'invalid_grant',
  };
}

export async function GET(): Promise<NextResponse> {
  const clientId = process.env.AUTH0_CLIENT_ID?.trim();
  const clientSecret = process.env.AUTH0_CLIENT_SECRET?.trim();
  const appBaseUrl = process.env.APP_BASE_URL?.trim();

  if (!clientId || !clientSecret || !appBaseUrl) {
    return NextResponse.json({ probeReady: false }, { status: 503 });
  }

  const common = {
    grant_type: 'authorization_code',
    code: 'nex70-intentionally-invalid-authorization-code',
    redirect_uri: new URL('/auth/callback', appBaseUrl).toString(),
    code_verifier: 'nex70-intentionally-invalid-code-verifier',
  };

  const post = await exchangeProbe(
    new URLSearchParams({ ...common, client_id: clientId, client_secret: clientSecret }),
    {},
  );

  const basicCredential = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  const basic = await exchangeProbe(new URLSearchParams(common), {
    authorization: `Basic ${basicCredential}`,
  });

  const none = await exchangeProbe(new URLSearchParams({ ...common, client_id: clientId }), {});

  return NextResponse.json({
    probeReady: true,
    post,
    basic,
    none,
    inferredMethod: post.accepted
      ? 'client_secret_post'
      : basic.accepted
        ? 'client_secret_basic'
        : none.accepted
          ? 'none'
          : 'credentials_rejected',
  });
}
