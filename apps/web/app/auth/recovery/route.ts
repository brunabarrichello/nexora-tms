import { NextRequest, NextResponse } from 'next/server';

import { readWebAuthConfig, requestPasswordRecovery } from '../../_lib/web-auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const config = readWebAuthConfig();
    const formData = await request.formData();
    const email = typeof formData.get('email') === 'string' ? String(formData.get('email')) : '';
    await requestPasswordRecovery(config, email);
    return NextResponse.redirect(new URL('/login?recovery=sent', config.appBaseUrl), 303);
  } catch {
    return NextResponse.redirect(new URL('/login?recovery=unavailable', request.url), 303);
  }
}
