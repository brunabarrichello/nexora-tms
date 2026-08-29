CREATE TYPE "public"."business_party_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "business_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tax_id" varchar(20) NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"trade_name" varchar(200),
	"email" varchar(254),
	"phone" varchar(32),
	"status" "business_party_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_parties_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "business_parties_tenant_tax_id_unique" UNIQUE("tenant_id","tax_id")
);
--> statement-breakpoint
ALTER TABLE "business_parties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "business_party_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"change_type" varchar(32) NOT NULL,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_party_audit_change_type_check" CHECK ("business_party_audit"."change_type" in ('created', 'updated'))
);
--> statement-breakpoint
ALTER TABLE "business_party_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "business_party_roles" (
	"tenant_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_party_roles_pk" PRIMARY KEY("tenant_id","party_id","role"),
	CONSTRAINT "business_party_roles_role_check" CHECK ("business_party_roles"."role" in ('customer', 'shipper', 'consignee'))
);
--> statement-breakpoint
ALTER TABLE "business_party_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business_parties" ADD CONSTRAINT "business_parties_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_audit" ADD CONSTRAINT "business_party_audit_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_roles" ADD CONSTRAINT "business_party_roles_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_parties_tenant_status_idx" ON "business_parties" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "business_party_audit_party_created_idx" ON "business_party_audit" USING btree ("tenant_id","party_id","created_at");--> statement-breakpoint
CREATE INDEX "business_party_roles_tenant_role_idx" ON "business_party_roles" USING btree ("tenant_id","role");--> statement-breakpoint
CREATE POLICY "business_parties_tenant_isolation" ON "business_parties" AS PERMISSIVE FOR ALL TO public USING ("business_parties"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_parties"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "business_party_audit_tenant_isolation" ON "business_party_audit" AS PERMISSIVE FOR ALL TO public USING ("business_party_audit"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_audit"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "business_party_roles_tenant_isolation" ON "business_party_roles" AS PERMISSIVE FOR ALL TO public USING ("business_party_roles"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_roles"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE business_parties TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE business_party_roles TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE business_party_audit TO nexora_app;
