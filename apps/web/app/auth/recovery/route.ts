import { NextRequest, NextResponse } from 'next/server';

import { readPasswordRecoveryConfig, requestPasswordRecovery } from '../../_lib/web-auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const config = readPasswordRecoveryConfig();
    const formData = await request.formData();
    const email = typeof formData.get('email') === 'string' ? String(formData.get('email')) : '';
    await requestPasswordRecovery(config, email);
    return NextResponse.redirect(new URL('/login?recovery=sent', request.url), 303);
  } catch {
    return NextResponse.redirect(new URL('/login?recovery=unavailable', request.url), 303);
  }
}
