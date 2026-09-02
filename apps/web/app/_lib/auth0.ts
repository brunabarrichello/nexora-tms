import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { NextResponse } from 'next/server';

const apiAudience =
  process.env.NEXORA_API_AUDIENCE?.trim() || process.env.OIDC_AUDIENCE?.trim() || undefined;

function classifyProviderReason(message: unknown): string | undefined {
  if (typeof message !== 'string') {
    return undefined;
  }

  const normalized = message.toLowerCase();

  if (normalized.includes('service not found')) return 'service_not_found';
  if (normalized.includes('audience')) return 'audience_policy';
  if (normalized.includes('consent')) return 'consent_denied';
  if (normalized.includes('blocked')) return 'user_blocked';
  if (normalized.includes('email') && normalized.includes('verif')) return 'email_verification';
  if (normalized.includes('organization')) return 'organization_policy';
  if (normalized.includes('connection')) return 'connection_policy';
  if (normalized.includes('scope')) return 'scope_policy';
  if (normalized.includes('rule') || normalized.includes('action')) return 'auth0_custom_policy';

  return 'other_access_denied';
}

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
    if (error) {
      const cause = (error as { cause?: { code?: unknown; message?: unknown } }).cause;
      const providerCode = typeof cause?.code === 'string' ? cause.code : undefined;
      const providerReason =
        providerCode === 'access_denied' ? classifyProviderReason(cause?.message) : undefined;

      console.error(
        'NEX70_AUTH0_CALLBACK_ERROR',
        JSON.stringify({ name: error.name, code: error.code, providerCode, providerReason }),
      );

      return NextResponse.json(
        {
          authCallbackError: true,
          code: error.code,
          ...(providerCode ? { providerCode } : {}),
          ...(providerReason ? { providerReason } : {}),
        },
        { status: 502 },
      );
    }

    const baseUrl = context.appBaseUrl || process.env.APP_BASE_URL || 'http://localhost:3000';
    const returnTo =
      context.returnTo?.startsWith('/') && !context.returnTo.startsWith('//')
        ? context.returnTo
        : '/';

    return NextResponse.redirect(new URL(returnTo, baseUrl));
  },
});
