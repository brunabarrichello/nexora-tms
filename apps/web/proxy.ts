import { NextRequest, NextResponse } from 'next/server';

import { auth0 } from './app/_lib/auth0';
import { safeReturnTo } from './app/_lib/web-auth';

const PUBLIC_PREFIXES = ['/login', '/auth/'];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // The official SDK owns the Auth0 routes, transaction cookie, state and PKCE.
  const authResponse = await auth0.middleware(request);
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix)) ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return authResponse;
  }

  try {
    const session = await auth0.getSession(request);
    if (session) return authResponse;
  } catch {
    // SDK/configuration failures fail closed for protected application routes.
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('returnTo', safeReturnTo(`${pathname}${request.nextUrl.search}`));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
