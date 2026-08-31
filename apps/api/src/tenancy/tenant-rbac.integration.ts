import { strict as assert } from 'node:assert';

import { Pool, type PoolClient } from 'pg';

import {
  TENANT_PERMISSIONS,
  TENANT_ROLE_TEMPLATES,
} from './rbac-catalog.js';
import {
  provisionTenantRbac,
  requireRbacProvisionTarget,
  type RbacProvisionResult,
} from './rbac-provisioner.js';
import { TenantContext } from './tenant-context.js';
import { TenantDatabaseService } from './tenant-database.service.js';
import { TenantPermissionService } from './tenant-permission.service.js';

const USER_A = '51000000-0000-4000-8000-000000000101';
const TENANT_A = '51000000-0000-4000-8000-000000000001';
const TENANT_B = '51000000-0000-4000-8000-000000000002';
const MEMBERSHIP_A = '51000000-0000-4000-8000-000000000301';

async function provisionInTransaction(
  client: PoolClient,
  tenantId: string,
  target: ReturnType<typeof requireRbacProvisionTarget>,
): Promise<RbacProvisionResult> {
  await client.query('BEGIN');
  try {
    const result = await provisionTenantRbac(client, tenantId, target);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function run(): Promise<void> {
  const provisionDatabaseUrl =
    process.env.RBAC_PROVISION_DATABASE_URL?.trim();
  if (!provisionDatabaseUrl) {
    throw new Error('RBAC_PROVISION_DATABASE_URL is required');
  }

  const target = requireRbacProvisionTarget(process.env.RBAC_PROVISION_TARGET);
  const adminPool = new Pool({
    application_name: 'nexora-tms-rbac-integration-admin',
    connectionString: provisionDatabaseUrl,
    max: 1,
  });

  const admin = await adminPool.connect();
  const runtimeDatabase = new TenantDatabaseService();

  try {
    const first = await provisionInTransaction(admin, TENANT_A, target);
    const second = await provisionInTransaction(admin, TENANT_A, target);
    await provisionInTransaction(admin, TENANT_B, target);

    assert.deepEqual(
      second,
      first,
      'repeat provisioning must produce the same catalog shape',
    );
    assert.equal(first.roleCount, Object.keys(TENANT_ROLE_TEMPLATES).length);

    const managedPermissionKeys = Object.values(TENANT_PERMISSIONS);
    const counts = await admin.query<{
      permissions: number;
      role_permissions: number;
      roles: number;
    }>(
      `SELECT
         (SELECT count(*)::int FROM permissions WHERE key = ANY($2::text[])) AS permissions,
         (SELECT count(*)::int FROM roles WHERE tenant_id = $1::uuid) AS roles,
         (SELECT count(*)::int FROM role_permissions WHERE tenant_id = $1::uuid) AS role_permissions`,
      [TENANT_A, managedPermissionKeys],
    );

    assert.equal(counts.rows[0]?.permissions, first.permissionCount);
    assert.equal(counts.rows[0]?.roles, first.roleCount);
    assert.equal(counts.rows[0]?.role_permissions, first.rolePermissionCount);

    await admin.query(
      `INSERT INTO membership_roles (tenant_id, membership_id, role_id)
       SELECT $1::uuid, $2::uuid, roles.id
         FROM roles
        WHERE roles.tenant_id = $1::uuid
          AND roles.code = 'viewer'
       ON CONFLICT (tenant_id, membership_id, role_id) DO NOTHING`,
      [TENANT_A, MEMBERSHIP_A],
    );

    const assignmentCount = await admin.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM membership_roles
        WHERE tenant_id = $1::uuid
          AND membership_id = $2::uuid`,
      [TENANT_A, MEMBERSHIP_A],
    );
    assert.equal(
      assignmentCount.rows[0]?.count,
      1,
      'fixture membership must receive one viewer role',
    );

    const tenantContext = new TenantContext();
    tenantContext.establish({
      subject: 'integration|rbac-user-a',
      tenantId: TENANT_A,
      userId: USER_A,
    });
    const permissions = new TenantPermissionService(
      tenantContext,
      runtimeDatabase,
    );

    assert.equal(await permissions.hasPermission('freight.read'), true);
    assert.equal(await permissions.hasPermission('freight.write'), false);
    assert.equal(await permissions.hasPermission('audit.read'), false);

    const tenantBLeakCount = await runtimeDatabase.withTenantContext(
      tenantContext.require(),
      async (client) => {
        const result = await client.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM roles WHERE tenant_id = $1::uuid',
          [TENANT_B],
        );
        return result.rows[0]?.count ?? -1;
      },
    );
    assert.equal(
      tenantBLeakCount,
      0,
      'tenant A runtime must not see tenant B roles',
    );

    const tenantBContext = new TenantContext();
    tenantBContext.establish({
      subject: 'integration|rbac-user-a',
      tenantId: TENANT_B,
      userId: USER_A,
    });
    const tenantBPermissions = new TenantPermissionService(
      tenantBContext,
      runtimeDatabase,
    );
    assert.equal(
      await tenantBPermissions.hasPermission('freight.read'),
      false,
      'user A must not inherit tenant B permissions without an active membership assignment',
    );
  } finally {
    admin.release();
    await adminPool.end();
    await runtimeDatabase.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
