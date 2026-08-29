import type { DriverOperationalStatus, DriverRegistrationStatus } from './driver.validation.js';

export interface DriverRow {
  readonly id: string;
  readonly carrier_party_id: string | null;
  readonly full_name: string;
  readonly tax_id: string;
  readonly email: string | null;
  readonly phone: string;
  readonly whatsapp: string | null;
  readonly cnh_number: string;
  readonly cnh_category: string;
  readonly cnh_expires_on: string;
  readonly registration_status: DriverRegistrationStatus;
  readonly operational_status: DriverOperationalStatus;
  readonly status_reason: string | null;
  readonly created_by_user_id: string;
  readonly updated_by_user_id: string;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface DriverView {
  readonly id: string;
  readonly carrierPartyId: string | null;
  readonly fullName: string;
  readonly taxId: string;
  readonly email: string | null;
  readonly phone: string;
  readonly whatsapp: string | null;
  readonly cnhNumber: string;
  readonly cnhCategory: string;
  readonly cnhExpiresOn: string;
  readonly registrationStatus: DriverRegistrationStatus;
  readonly operationalStatus: DriverOperationalStatus;
  readonly statusReason: string | null;
  readonly eligibleForMatching: boolean;
  readonly createdByUserId: string;
  readonly updatedByUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DriverAuditRow {
  readonly id: string;
  readonly change_type: 'created' | 'updated' | 'status_changed';
  readonly actor_user_id: string;
  readonly before_snapshot: Record<string, unknown> | null;
  readonly after_snapshot: Record<string, unknown>;
  readonly created_at: Date;
}

export interface DriverAuditView {
  readonly id: string;
  readonly changeType: 'created' | 'updated' | 'status_changed';
  readonly actorUserId: string;
  readonly beforeSnapshot: Record<string, unknown> | null;
  readonly afterSnapshot: Record<string, unknown>;
  readonly createdAt: string;
}

export const DRIVER_COLUMNS = `
  id::text AS id,
  carrier_party_id::text AS carrier_party_id,
  full_name,
  tax_id,
  email,
  phone,
  whatsapp,
  cnh_number,
  cnh_category,
  cnh_expires_on::text AS cnh_expires_on,
  registration_status::text AS registration_status,
  operational_status::text AS operational_status,
  status_reason,
  created_by_user_id::text AS created_by_user_id,
  updated_by_user_id::text AS updated_by_user_id,
  created_at,
  updated_at`;

export function mapDriver(row: DriverRow): DriverView {
  return {
    id: row.id,
    carrierPartyId: row.carrier_party_id,
    fullName: row.full_name,
    taxId: row.tax_id,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    cnhNumber: row.cnh_number,
    cnhCategory: row.cnh_category,
    cnhExpiresOn: row.cnh_expires_on,
    registrationStatus: row.registration_status,
    operationalStatus: row.operational_status,
    statusReason: row.status_reason,
    eligibleForMatching:
      row.registration_status === 'qualified' && row.operational_status === 'active',
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapDriverAudit(row: DriverAuditRow): DriverAuditView {
  return {
    id: row.id,
    changeType: row.change_type,
    actorUserId: row.actor_user_id,
    beforeSnapshot: row.before_snapshot,
    afterSnapshot: row.after_snapshot,
    createdAt: row.created_at.toISOString(),
  };
}
