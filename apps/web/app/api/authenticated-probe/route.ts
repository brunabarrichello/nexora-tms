import { NextResponse } from 'next/server';

import { apiGet } from '../../_lib/api-client';

type AuthenticatedUserProbe = {
  authenticated: true;
  userId: string;
};

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const result = await apiGet<AuthenticatedUserProbe>('/api/v1/auth/me');

    return NextResponse.json({
      authenticated: result.authenticated === true,
      identityLinked: Boolean(result.userId),
    });
  } catch {
    return NextResponse.json(
      {
        authenticated: false,
        identityLinked: false,
      },
      { status: 502 },
    );
  }
}
