import { NextResponse } from 'next/server';

import { apiGet } from '../../_lib/api-client';
import { auth0 } from '../../_lib/auth0';

type AuthenticatedUserProbe = {
  authenticated: true;
  userId: string;
};

type TenantRuntimeGate = {
  authenticated: true;
  rlsIsolated: true;
  tenantId: string;
};

const DEVELOPMENT_TENANT_A = '57000000-0000-4000-8000-000000000001';
const DEVELOPMENT_TENANT_B = '57000000-0000-4000-8000-000000000002';
const STAGING_TENANT_A = '58000000-0000-4000-8000-000000000001';
const STAGING_TENANT_B = '58000000-0000-4000-8000-000000000002';

function probeTenants(): { tenantA: string; tenantB: string } {
  const environment = (
    process.env.APP_ENV?.trim() ||
    process.env.RAILWAY_ENVIRONMENT_NAME?.trim() ||
    ''
  ).toLowerCase();

  if (environment === 'staging') {
    return { tenantA: STAGING_TENANT_A, tenantB: STAGING_TENANT_B };
  }

  return { tenantA: DEVELOPMENT_TENANT_A, tenantB: DEVELOPMENT_TENANT_B };
}

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const identity = await apiGet<AuthenticatedUserProbe>('/api/v1/auth/me');

  if (identity.kind !== 'ready') {
    return NextResponse.json(
      {
        authenticated: false,
        identityLinked: false,
        tenantAAuthorized: false,
        tenantARlsIsolated: false,
        tenantBDenied: false,
      },
      { status: 502 },
    );
  }

  const apiBaseUrlValue = process.env.NEXORA_API_BASE_URL?.trim();
  if (!apiBaseUrlValue) {
    return NextResponse.json(
      {
        authenticated: true,
        identityLinked: Boolean(identity.data.userId),
        tenantAAuthorized: false,
        tenantARlsIsolated: false,
        tenantBDenied: false,
      },
      { status: 502 },
    );
  }

  try {
    const token = (await auth0.getAccessToken()).token;
    const gateUrl = new URL('/api/v1/tenant/runtime-gate', apiBaseUrlValue);
    const { tenantA, tenantB } = probeTenants();

    const [tenantAResponse, tenantBResponse] = await Promise.all([
      fetch(gateUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'x-nexora-tenant-id': tenantA,
        },
        cache: 'no-store',
      }),
      fetch(gateUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'x-nexora-tenant-id': tenantB,
        },
        cache: 'no-store',
      }),
    ]);

    let tenantARlsIsolated = false;
    if (tenantAResponse.ok) {
      const tenantAResult = (await tenantAResponse.json()) as TenantRuntimeGate;
      tenantARlsIsolated =
        tenantAResult.authenticated === true && tenantAResult.rlsIsolated === true;
    }

    const tenantAAuthorized = tenantAResponse.status === 200;
    const tenantBDenied = tenantBResponse.status === 403;
    const passed = tenantAAuthorized && tenantARlsIsolated && tenantBDenied;

    return NextResponse.json(
      {
        authenticated: identity.data.authenticated === true,
        identityLinked: Boolean(identity.data.userId),
        tenantAAuthorized,
        tenantARlsIsolated,
        tenantBDenied,
      },
      { status: passed ? 200 : 502 },
    );
  } catch {
    return NextResponse.json(
      {
        authenticated: true,
        identityLinked: Boolean(identity.data.userId),
        tenantAAuthorized: false,
        tenantARlsIsolated: false,
        tenantBDenied: false,
      },
      { status: 502 },
    );
  }
}
