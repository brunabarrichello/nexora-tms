GRANT USAGE ON SCHEMA public TO nexora_app;
--> statement-breakpoint
GRANT SELECT ON TABLE tenants, users, external_identities, permissions TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  tenant_settings,
  organizations,
  business_units,
  memberships,
  roles,
  role_permissions,
  membership_roles,
  membership_organization_scopes,
  membership_business_unit_scopes
TO nexora_app;
