import { NextRequest, NextResponse } from 'next/server';

import {
  AUTH_TRANSACTION_COOKIE,
  WEB_SESSION_COOKIE,
  type AuthTransaction,
  createWebSession,
  exchangeAuthorizationCode,
  openAuthValue,
  readWebAuthConfig,
  resolveNexoraUser,
  sealAuthValue,
  transactionStateMatches,
} from '../../_lib/web-auth';

function clearTransaction(response: NextResponse, secure: boolean): void {
  response.cookies.set(AUTH_TRANSACTION_COOKIE, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let config;
  try {
    config = readWebAuthConfig();
  } catch {
    return NextResponse.redirect(new URL('/login?error=configuration', request.url));
  }

  const secure = config.appBaseUrl.protocol === 'https:';
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const sealedTransaction = request.cookies.get(AUTH_TRANSACTION_COOKIE)?.value;
  const transaction = openAuthValue<AuthTransaction>(sealedTransaction, config.sessionSecret);

  if (!code || !state || !transaction || !transactionStateMatches(transaction, state)) {
    const response = NextResponse.redirect(new URL('/login?error=invalid_callback', request.url));
    clearTransaction(response, secure);
    return response;
  }

  try {
    const token = await exchangeAuthorizationCode(config, code, transaction.codeVerifier);
    const userId = await resolveNexoraUser(config, token.accessToken);
    const session = createWebSession(token.accessToken, token.expiresIn, userId);
    const response = NextResponse.redirect(new URL(transaction.returnTo, config.appBaseUrl));

    clearTransaction(response, secure);
    response.cookies.set(WEB_SESSION_COOKIE, sealAuthValue(session, config.sessionSecret), {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      expires: new Date(session.expiresAt),
    });

    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL('/login?error=authentication', config.appBaseUrl),
    );
    clearTransaction(response, secure);
    response.cookies.set(WEB_SESSION_COOKIE, '', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  }
}
