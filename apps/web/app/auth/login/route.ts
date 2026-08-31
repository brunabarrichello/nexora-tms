import { NextRequest, NextResponse } from 'next/server';

import {
  AUTH_TRANSACTION_COOKIE,
  AUTH_TRANSACTION_TTL_SECONDS,
  buildAuthorizationUrl,
  createAuthTransaction,
  readWebAuthConfig,
  sealAuthValue,
} from '../../_lib/web-auth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const config = readWebAuthConfig();
    const transaction = createAuthTransaction(request.nextUrl.searchParams.get('returnTo') ?? '/');
    const response = NextResponse.redirect(buildAuthorizationUrl(config, transaction));

    response.cookies.set(
      AUTH_TRANSACTION_COOKIE,
      sealAuthValue(transaction, config.sessionSecret),
      {
        httpOnly: true,
        secure: config.appBaseUrl.protocol === 'https:',
        sameSite: 'lax',
        path: '/',
        maxAge: AUTH_TRANSACTION_TTL_SECONDS,
      },
    );

    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?error=configuration', request.url));
  }
}
