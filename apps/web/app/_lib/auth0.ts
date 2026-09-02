import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { NextResponse } from 'next/server';

const apiAudience =
  process.env.NEXORA_API_AUDIENCE?.trim() || process.env.OIDC_AUDIENCE?.trim() || undefined;

/**
 * Server-side Auth0 client for the Nexora Web BFF.
 *
 * The official SDK owns Authorization Code + PKCE, transaction state and the
 * encrypted HttpOnly Web session. Nexora never exposes the API access token to
 * browser JavaScript; server-side API calls obtain it through getAccessToken().
 */
export const auth0 = new Auth0Client({
  authorizationParameters: apiAudience ? { audience: apiAudience } : undefined,
  enableAccessTokenEndpoint: false,
  async onCallback(error, context) {
    const baseUrl = context.appBaseUrl || process.env.APP_BASE_URL || 'http://localhost:3000';

    if (error) {
      const loginUrl = new URL('/login', baseUrl);
      loginUrl.searchParams.set('error', '1');
      return NextResponse.redirect(loginUrl);
    }

    const returnTo =
      context.returnTo?.startsWith('/') && !context.returnTo.startsWith('//')
        ? context.returnTo
        : '/';

    return NextResponse.redirect(new URL(returnTo, baseUrl));
  },
});
