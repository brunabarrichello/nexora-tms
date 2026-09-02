import { NextResponse } from 'next/server';

import { auth0 } from '../../_lib/auth0';

const DEVELOPMENT_API = 'https://nexora-tms-api-development.up.railway.app';
const STAGING_API = 'https://nexora-tms-api-staging.up.railway.app';

export const dynamic = 'force-dynamic';

function environmentName(): 'development' | 'staging' | 'unknown' {
  const environment = (
    process.env.NEXORA_ENVIRONMENT?.trim() ||
    process.env.APP_ENV?.trim() ||
    process.env.RAILWAY_ENVIRONMENT_NAME?.trim() ||
    ''
  ).toLowerCase();

  if (environment === 'development') return 'development';
  if (environment === 'staging') return 'staging';
  return 'unknown';
}

async function authMeStatus(baseUrl: string, token: string): Promise<number> {
  const url = new URL('/api/v1/auth/me', baseUrl);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  return response.status;
}

export async function GET(): Promise<NextResponse> {
  const environment = environmentName();
  if (environment === 'unknown') {
    return NextResponse.json(
      {
        environment,
        ownStatus: null,
        crossStatus: null,
        audienceSeparated: false,
      },
      { status: 502 },
    );
  }

  try {
    const token = (await auth0.getAccessToken()).token;
    const ownApi = environment === 'staging' ? STAGING_API : DEVELOPMENT_API;
    const crossApi = environment === 'staging' ? DEVELOPMENT_API : STAGING_API;

    const [ownStatus, crossStatus] = await Promise.all([
      authMeStatus(ownApi, token),
      authMeStatus(crossApi, token),
    ]);
    const audienceSeparated = ownStatus === 200 && crossStatus === 401;

    return NextResponse.json(
      {
        environment,
        ownStatus,
        crossStatus,
        audienceSeparated,
      },
      { status: audienceSeparated ? 200 : 502 },
    );
  } catch {
    return NextResponse.json(
      {
        environment,
        ownStatus: null,
        crossStatus: null,
        audienceSeparated: false,
      },
      { status: 502 },
    );
  }
}
