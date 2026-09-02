export const TENANT_PERMISSIONS = {
  IAM_READ: 'iam.read',
  IAM_MANAGE: 'iam.manage',
  TENANT_READ: 'tenant.read',
  TENANT_MANAGE: 'tenant.manage',
  MASTER_DATA_READ: 'master-data.read',
  MASTER_DATA_WRITE: 'master-data.write',
  CAPACITY_READ: 'capacity.read',
  CAPACITY_WRITE: 'capacity.write',
  DOCUMENTS_READ: 'documents.read',
  DOCUMENTS_WRITE: 'documents.write',
  FREIGHT_READ: 'freight.read',
  FREIGHT_WRITE: 'freight.write',
  MATCHING_READ: 'matching.read',
  MATCHING_WRITE: 'matching.write',
  NEGOTIATION_READ: 'negotiation.read',
  NEGOTIATION_WRITE: 'negotiation.write',
  TRIPS_READ: 'trips.read',
  TRIPS_WRITE: 'trips.write',
  FINANCE_READ: 'finance.read',
  AUDIT_READ: 'audit.read',
} as const;

export type TenantPermissionKey = (typeof TENANT_PERMISSIONS)[keyof typeof TENANT_PERMISSIONS];

export interface TenantRoleTemplate {
  readonly code: string;
  readonly name: string;
  readonly permissions: readonly TenantPermissionKey[];
}

const allPermissions = Object.values(TENANT_PERMISSIONS) as TenantPermissionKey[];

export const TENANT_ROLE_TEMPLATES = {
  TENANT_ADMIN: {
    code: 'tenant_admin',
    name: 'Tenant Admin',
    permissions: allPermissions,
  },
  OPERATIONS_MANAGER: {
    code: 'operations_manager',
    name: 'Operations Manager',
    permissions: [
      TENANT_PERMISSIONS.TENANT_READ,
      TENANT_PERMISSIONS.MASTER_DATA_READ,
      TENANT_PERMISSIONS.MASTER_DATA_WRITE,
      TENANT_PERMISSIONS.CAPACITY_READ,
      TENANT_PERMISSIONS.CAPACITY_WRITE,
      TENANT_PERMISSIONS.DOCUMENTS_READ,
      TENANT_PERMISSIONS.DOCUMENTS_WRITE,
      TENANT_PERMISSIONS.FREIGHT_READ,
      TENANT_PERMISSIONS.FREIGHT_WRITE,
      TENANT_PERMISSIONS.MATCHING_READ,
      TENANT_PERMISSIONS.MATCHING_WRITE,
      TENANT_PERMISSIONS.NEGOTIATION_READ,
      TENANT_PERMISSIONS.NEGOTIATION_WRITE,
      TENANT_PERMISSIONS.TRIPS_READ,
      TENANT_PERMISSIONS.TRIPS_WRITE,
      TENANT_PERMISSIONS.FINANCE_READ,
      TENANT_PERMISSIONS.AUDIT_READ,
    ],
  },
  DISPATCHER: {
    code: 'dispatcher',
    name: 'Dispatcher',
    permissions: [
      TENANT_PERMISSIONS.TENANT_READ,
      TENANT_PERMISSIONS.MASTER_DATA_READ,
      TENANT_PERMISSIONS.CAPACITY_READ,
      TENANT_PERMISSIONS.DOCUMENTS_READ,
      TENANT_PERMISSIONS.DOCUMENTS_WRITE,
      TENANT_PERMISSIONS.FREIGHT_READ,
      TENANT_PERMISSIONS.FREIGHT_WRITE,
      TENANT_PERMISSIONS.MATCHING_READ,
      TENANT_PERMISSIONS.MATCHING_WRITE,
      TENANT_PERMISSIONS.NEGOTIATION_READ,
      TENANT_PERMISSIONS.NEGOTIATION_WRITE,
      TENANT_PERMISSIONS.TRIPS_READ,
      TENANT_PERMISSIONS.TRIPS_WRITE,
    ],
  },
  FINANCE_MANAGER: {
    code: 'finance_manager',
    name: 'Finance Manager',
    permissions: [
      TENANT_PERMISSIONS.TENANT_READ,
      TENANT_PERMISSIONS.MASTER_DATA_READ,
      TENANT_PERMISSIONS.DOCUMENTS_READ,
      TENANT_PERMISSIONS.FREIGHT_READ,
      TENANT_PERMISSIONS.NEGOTIATION_READ,
      TENANT_PERMISSIONS.TRIPS_READ,
      TENANT_PERMISSIONS.FINANCE_READ,
      TENANT_PERMISSIONS.AUDIT_READ,
    ],
  },
  AUDITOR: {
    code: 'auditor',
    name: 'Auditor',
    permissions: [
      TENANT_PERMISSIONS.IAM_READ,
      TENANT_PERMISSIONS.TENANT_READ,
      TENANT_PERMISSIONS.MASTER_DATA_READ,
      TENANT_PERMISSIONS.CAPACITY_READ,
      TENANT_PERMISSIONS.DOCUMENTS_READ,
      TENANT_PERMISSIONS.FREIGHT_READ,
      TENANT_PERMISSIONS.MATCHING_READ,
      TENANT_PERMISSIONS.NEGOTIATION_READ,
      TENANT_PERMISSIONS.TRIPS_READ,
      TENANT_PERMISSIONS.FINANCE_READ,
      TENANT_PERMISSIONS.AUDIT_READ,
    ],
  },
  VIEWER: {
    code: 'viewer',
    name: 'Viewer',
    permissions: [
      TENANT_PERMISSIONS.TENANT_READ,
      TENANT_PERMISSIONS.MASTER_DATA_READ,
      TENANT_PERMISSIONS.CAPACITY_READ,
      TENANT_PERMISSIONS.DOCUMENTS_READ,
      TENANT_PERMISSIONS.FREIGHT_READ,
      TENANT_PERMISSIONS.MATCHING_READ,
      TENANT_PERMISSIONS.NEGOTIATION_READ,
      TENANT_PERMISSIONS.TRIPS_READ,
    ],
  },
} as const satisfies Record<string, TenantRoleTemplate>;

export function isTenantPermissionKey(value: string): value is TenantPermissionKey {
  return (Object.values(TENANT_PERMISSIONS) as string[]).includes(value);
}
