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

const TENANT_A = '57000000-0000-4000-8000-000000000001';
const TENANT_B = '57000000-0000-4000-8000-000000000002';

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

    const [tenantAResponse, tenantBResponse] = await Promise.all([
      fetch(gateUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'x-nexora-tenant-id': TENANT_A,
        },
        cache: 'no-store',
      }),
      fetch(gateUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'x-nexora-tenant-id': TENANT_B,
        },
        cache: 'no-store',
      }),
    ]);

    let tenantARlsIsolated = false;
    if (tenantAResponse.ok) {
      const tenantA = (await tenantAResponse.json()) as TenantRuntimeGate;
      tenantARlsIsolated = tenantA.authenticated === true && tenantA.rlsIsolated === true;
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
