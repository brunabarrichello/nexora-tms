import { NextRequest, NextResponse } from 'next/server';

import {
  AUTH_TRANSACTION_COOKIE,
  WEB_SESSION_COOKIE,
  buildLogoutUrl,
  readWebAuthConfig,
} from '../../_lib/web-auth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  let response: NextResponse;
  let secure = request.nextUrl.protocol === 'https:';

  try {
    const config = readWebAuthConfig();
    secure = config.appBaseUrl.protocol === 'https:';
    response = NextResponse.redirect(buildLogoutUrl(config));
  } catch {
    response = NextResponse.redirect(new URL('/login?logged_out=1', request.url));
  }

  for (const name of [WEB_SESSION_COOKIE, AUTH_TRANSACTION_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  return response;
}
