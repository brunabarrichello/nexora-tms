CREATE TYPE "public"."driver_operational_status" AS ENUM('active', 'blocked', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."driver_registration_status" AS ENUM('pending', 'qualified', 'blocked', 'inactive');--> statement-breakpoint
CREATE TABLE "driver_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"change_type" varchar(32) NOT NULL,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_audit_change_type_check" CHECK ("driver_audit"."change_type" in ('created','updated','status_changed'))
);
--> statement-breakpoint
ALTER TABLE "driver_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"carrier_party_id" uuid,
	"full_name" varchar(180) NOT NULL,
	"tax_id" varchar(11) NOT NULL,
	"email" varchar(254),
	"phone" varchar(32) NOT NULL,
	"whatsapp" varchar(32),
	"cnh_number" varchar(11) NOT NULL,
	"cnh_category" varchar(4) NOT NULL,
	"cnh_expires_on" date NOT NULL,
	"registration_status" "driver_registration_status" DEFAULT 'pending' NOT NULL,
	"operational_status" "driver_operational_status" DEFAULT 'inactive' NOT NULL,
	"status_reason" varchar(500),
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_tenant_tax_id_unique" UNIQUE("tenant_id","tax_id"),
	CONSTRAINT "drivers_tenant_cnh_unique" UNIQUE("tenant_id","cnh_number"),
	CONSTRAINT "drivers_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "drivers_tax_id_check" CHECK ("drivers"."tax_id" ~ '^[0-9]{11}$'),
	CONSTRAINT "drivers_cnh_number_check" CHECK ("drivers"."cnh_number" ~ '^[0-9]{11}$'),
	CONSTRAINT "drivers_cnh_category_check" CHECK ("drivers"."cnh_category" ~ '^(A|B|C|D|E|AB|AC|AD|AE)$'),
	CONSTRAINT "drivers_name_check" CHECK (length(trim("drivers"."full_name")) >= 3),
	CONSTRAINT "drivers_phone_check" CHECK (length(trim("drivers"."phone")) >= 8),
	CONSTRAINT "drivers_active_status_check" CHECK ("drivers"."operational_status" <> 'active' OR "drivers"."registration_status" = 'qualified'),
	CONSTRAINT "drivers_status_reason_check" CHECK (("drivers"."registration_status" NOT IN ('blocked','inactive') AND "drivers"."operational_status" <> 'blocked') OR "drivers"."status_reason" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "drivers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "driver_audit" ADD CONSTRAINT "driver_audit_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_audit" ADD CONSTRAINT "driver_audit_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_carrier_party_fk" FOREIGN KEY ("tenant_id","carrier_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "driver_audit_tenant_driver_idx" ON "driver_audit" USING btree ("tenant_id","driver_id","created_at");--> statement-breakpoint
CREATE INDEX "drivers_tenant_registration_status_idx" ON "drivers" USING btree ("tenant_id","registration_status");--> statement-breakpoint
CREATE INDEX "drivers_tenant_operational_status_idx" ON "drivers" USING btree ("tenant_id","operational_status");--> statement-breakpoint
CREATE INDEX "drivers_tenant_carrier_idx" ON "drivers" USING btree ("tenant_id","carrier_party_id");--> statement-breakpoint
CREATE POLICY "driver_audit_tenant_isolation" ON "driver_audit" AS PERMISSIVE FOR ALL TO public USING ("driver_audit"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("driver_audit"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "drivers_tenant_isolation" ON "drivers" AS PERMISSIVE FOR ALL TO public USING ("drivers"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("drivers"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE drivers TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE driver_audit TO nexora_app;
