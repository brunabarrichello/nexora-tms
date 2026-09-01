import { NextResponse } from 'next/server';

import { apiGet } from '../../_lib/api-client';

type AuthenticatedUserProbe = {
  authenticated: true;
  userId: string;
};

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const result = await apiGet<AuthenticatedUserProbe>('/api/v1/auth/me');

  if (result.kind !== 'ready') {
    return NextResponse.json(
      {
        authenticated: false,
        identityLinked: false,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    authenticated: result.data.authenticated === true,
    identityLinked: Boolean(result.data.userId),
  });
}
