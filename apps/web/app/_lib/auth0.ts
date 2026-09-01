import { Auth0Client } from '@auth0/nextjs-auth0/server';

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
});
