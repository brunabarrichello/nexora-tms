import { NextRequest, NextResponse } from 'next/server';

import {
  WEB_SESSION_COOKIE,
  type WebSession,
  isWebSessionActive,
  openAuthValue,
  readWebAuthConfig,
} from './app/_lib/web-auth';

const PUBLIC_PREFIXES = ['/login', '/auth/'];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix)) ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  try {
    const config = readWebAuthConfig();
    const sealed = request.cookies.get(WEB_SESSION_COOKIE)?.value;
    const session = openAuthValue<WebSession>(sealed, config.sessionSecret);
    if (session && isWebSessionActive(session)) return NextResponse.next();
  } catch {
    // Authentication configuration errors fail closed for protected routes.
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('returnTo', `${pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(WEB_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export const config = {
  matcher: '/:path*',
};
