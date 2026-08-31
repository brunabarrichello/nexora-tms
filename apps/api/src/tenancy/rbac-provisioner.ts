import type { PoolClient } from 'pg';

import {
  TENANT_PERMISSIONS,
  TENANT_ROLE_TEMPLATES,
  type TenantPermissionKey,
  type TenantRoleTemplate,
} from './rbac-catalog.js';

export type RbacProvisionTarget = 'development' | 'staging' | 'ephemeral';

export interface RbacProvisionResult {
  readonly permissionCount: number;
  readonly roleCount: number;
  readonly rolePermissionCount: number;
  readonly tenantId: string;
}

export function requireRbacProvisionTarget(value: string | undefined): RbacProvisionTarget {
  const target = value?.trim().toLowerCase();
  if (target === 'development' || target === 'staging' || target === 'ephemeral') {
    return target;
  }

  throw new Error('RBAC provisioning is forbidden outside development, staging or ephemeral');
}

export async function provisionTenantRbac(
  client: PoolClient,
  tenantId: string,
  target: RbacProvisionTarget,
): Promise<RbacProvisionResult> {
  requireRbacProvisionTarget(target);

  const permissionIds = new Map<TenantPermissionKey, string>();

  for (const permissionKey of Object.values(TENANT_PERMISSIONS)) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO permissions (key, description)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description
       RETURNING id::text AS id`,
      [permissionKey, `Nexora tenant permission: ${permissionKey}`],
    );

    const permissionId = result.rows[0]?.id;
    if (!permissionId) throw new Error(`Failed to provision permission ${permissionKey}`);
    permissionIds.set(permissionKey, permissionId);
  }

  let rolePermissionCount = 0;
  for (const roleTemplate of Object.values(TENANT_ROLE_TEMPLATES)) {
    rolePermissionCount += await synchronizeRole(client, tenantId, roleTemplate, permissionIds);
  }

  return {
    permissionCount: permissionIds.size,
    roleCount: Object.keys(TENANT_ROLE_TEMPLATES).length,
    rolePermissionCount,
    tenantId,
  };
}

async function synchronizeRole(
  client: PoolClient,
  tenantId: string,
  template: TenantRoleTemplate,
  permissionIds: ReadonlyMap<TenantPermissionKey, string>,
): Promise<number> {
  const roleResult = await client.query<{ id: string }>(
    `INSERT INTO roles (tenant_id, code, name, description)
     VALUES ($1::uuid, $2, $3, $4)
     ON CONFLICT (tenant_id, code) DO UPDATE
       SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now()
     RETURNING id::text AS id`,
    [tenantId, template.code, template.name, `Nexora managed role: ${template.code}`],
  );

  const roleId = roleResult.rows[0]?.id;
  if (!roleId) throw new Error(`Failed to provision role ${template.code}`);

  const expectedPermissionIds = template.permissions.map((permissionKey) => {
    const permissionId = permissionIds.get(permissionKey);
    if (!permissionId) throw new Error(`Permission ${permissionKey} was not provisioned`);
    return permissionId;
  });

  await client.query(
    `DELETE FROM role_permissions
      WHERE tenant_id = $1::uuid
        AND role_id = $2::uuid
        AND NOT (permission_id = ANY($3::uuid[]))`,
    [tenantId, roleId, expectedPermissionIds],
  );

  for (const permissionId of expectedPermissionIds) {
    await client.query(
      `INSERT INTO role_permissions (tenant_id, role_id, permission_id)
       VALUES ($1::uuid, $2::uuid, $3::uuid)
       ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING`,
      [tenantId, roleId, permissionId],
    );
  }

  return expectedPermissionIds.length;
}
