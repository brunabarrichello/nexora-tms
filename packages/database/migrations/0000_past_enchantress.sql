CREATE TYPE "public"."membership_status" AS ENUM('invited', 'active', 'suspended', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "membership_business_unit_scopes" (
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"business_unit_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_business_unit_scopes_pk" PRIMARY KEY("tenant_id","membership_id","business_unit_id")
);
--> statement-breakpoint
ALTER TABLE "membership_business_unit_scopes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "membership_organization_scopes" (
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_organization_scopes_pk" PRIMARY KEY("tenant_id","membership_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "membership_organization_scopes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "membership_roles" (
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_roles_pk" PRIMARY KEY("tenant_id","membership_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "membership_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(160) NOT NULL,
	"description" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"tenant_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_pk" PRIMARY KEY("tenant_id","role_id","permission_id")
);
--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "roles_tenant_code_unique" UNIQUE("tenant_id","code")
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "external_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(80) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "external_identities_provider_subject_unique" UNIQUE("provider","subject"),
	CONSTRAINT "external_identities_user_provider_unique" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "membership_status" DEFAULT 'invited' NOT NULL,
	"invited_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "memberships_tenant_user_unique" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(200),
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_business_unit_id" uuid,
	"code" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_units_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "business_units_tenant_org_id_id_unique" UNIQUE("tenant_id","organization_id","id"),
	CONSTRAINT "business_units_tenant_org_code_unique" UNIQUE("tenant_id","organization_id","code")
);
--> statement-breakpoint
ALTER TABLE "business_units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "organizations_tenant_code_unique" UNIQUE("tenant_id","code")
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "membership_business_unit_scopes" ADD CONSTRAINT "membership_business_unit_scopes_membership_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."memberships"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_business_unit_scopes" ADD CONSTRAINT "membership_business_unit_scopes_business_unit_fk" FOREIGN KEY ("tenant_id","business_unit_id") REFERENCES "public"."business_units"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_organization_scopes" ADD CONSTRAINT "membership_organization_scopes_membership_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."memberships"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_organization_scopes" ADD CONSTRAINT "membership_organization_scopes_organization_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_tenant_membership_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."memberships"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_tenant_role_fk" FOREIGN KEY ("tenant_id","role_id") REFERENCES "public"."roles"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_role_fk" FOREIGN KEY ("tenant_id","role_id") REFERENCES "public"."roles"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_tenant_org_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_parent_fk" FOREIGN KEY ("tenant_id","organization_id","parent_business_unit_id") REFERENCES "public"."business_units"("tenant_id","organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_business_unit_scopes_unit_idx" ON "membership_business_unit_scopes" USING btree ("tenant_id","business_unit_id");--> statement-breakpoint
CREATE INDEX "membership_organization_scopes_org_idx" ON "membership_organization_scopes" USING btree ("tenant_id","organization_id");--> statement-breakpoint
CREATE INDEX "membership_roles_role_idx" ON "membership_roles" USING btree ("tenant_id","role_id");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "roles_tenant_idx" ON "roles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "external_identities_user_idx" ON "external_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_tenant_status_idx" ON "memberships" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "business_units_tenant_org_idx" ON "business_units" USING btree ("tenant_id","organization_id");--> statement-breakpoint
CREATE INDEX "organizations_tenant_idx" ON "organizations" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "membership_business_unit_scopes_tenant_isolation" ON "membership_business_unit_scopes" AS PERMISSIVE FOR ALL TO public USING ("membership_business_unit_scopes"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("membership_business_unit_scopes"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "membership_organization_scopes_tenant_isolation" ON "membership_organization_scopes" AS PERMISSIVE FOR ALL TO public USING ("membership_organization_scopes"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("membership_organization_scopes"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "membership_roles_tenant_isolation" ON "membership_roles" AS PERMISSIVE FOR ALL TO public USING ("membership_roles"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("membership_roles"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "role_permissions_tenant_isolation" ON "role_permissions" AS PERMISSIVE FOR ALL TO public USING ("role_permissions"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("role_permissions"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "roles_tenant_isolation" ON "roles" AS PERMISSIVE FOR ALL TO public USING ("roles"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("roles"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "memberships_select_own_or_tenant" ON "memberships" AS PERMISSIVE FOR SELECT TO public USING (("memberships"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) OR ("memberships"."user_id" = nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "memberships_insert_tenant" ON "memberships" AS PERMISSIVE FOR INSERT TO public WITH CHECK ("memberships"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "memberships_update_tenant" ON "memberships" AS PERMISSIVE FOR UPDATE TO public USING ("memberships"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("memberships"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "memberships_delete_tenant" ON "memberships" AS PERMISSIVE FOR DELETE TO public USING ("memberships"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "business_units_tenant_isolation" ON "business_units" AS PERMISSIVE FOR ALL TO public USING ("business_units"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_units"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "organizations_tenant_isolation" ON "organizations" AS PERMISSIVE FOR ALL TO public USING ("organizations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("organizations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_settings_tenant_isolation" ON "tenant_settings" AS PERMISSIVE FOR ALL TO public USING ("tenant_settings"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_settings"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenants_tenant_isolation" ON "tenants" AS PERMISSIVE FOR ALL TO public USING ("tenants"."id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenants"."id" = nullif(current_setting('app.tenant_id', true), '')::uuid);