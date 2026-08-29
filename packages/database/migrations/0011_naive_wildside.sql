CREATE TYPE "public"."capacity_assignment_status" AS ENUM('active', 'ended', 'cancelled');--> statement-breakpoint
CREATE TABLE "capacity_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"carrier_party_id" uuid NOT NULL,
	"status" "capacity_assignment_status" DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"status_reason" varchar(500),
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capacity_assignments_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_assignments_period_check" CHECK ("capacity_assignments"."ends_at" IS NULL OR "capacity_assignments"."ends_at" >= "capacity_assignments"."starts_at"),
	CONSTRAINT "capacity_assignments_active_period_check" CHECK (("capacity_assignments"."status" = 'active' AND "capacity_assignments"."ends_at" IS NULL) OR ("capacity_assignments"."status" IN ('ended','cancelled') AND "capacity_assignments"."ends_at" IS NOT NULL)),
	CONSTRAINT "capacity_assignments_cancel_reason_check" CHECK ("capacity_assignments"."status" <> 'cancelled' OR "capacity_assignments"."status_reason" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "capacity_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "capacity_assignments" ADD CONSTRAINT "capacity_assignments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_assignments" ADD CONSTRAINT "capacity_assignments_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_assignments" ADD CONSTRAINT "capacity_assignments_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_assignments" ADD CONSTRAINT "capacity_assignments_vehicle_fk" FOREIGN KEY ("tenant_id","vehicle_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_assignments" ADD CONSTRAINT "capacity_assignments_carrier_party_fk" FOREIGN KEY ("tenant_id","carrier_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capacity_assignments_active_driver_unique" ON "capacity_assignments" USING btree ("tenant_id","driver_id") WHERE "capacity_assignments"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "capacity_assignments_active_vehicle_unique" ON "capacity_assignments" USING btree ("tenant_id","vehicle_id") WHERE "capacity_assignments"."status" = 'active';--> statement-breakpoint
CREATE INDEX "capacity_assignments_tenant_carrier_status_idx" ON "capacity_assignments" USING btree ("tenant_id","carrier_party_id","status");--> statement-breakpoint
CREATE INDEX "capacity_assignments_tenant_driver_history_idx" ON "capacity_assignments" USING btree ("tenant_id","driver_id","starts_at");--> statement-breakpoint
CREATE INDEX "capacity_assignments_tenant_vehicle_history_idx" ON "capacity_assignments" USING btree ("tenant_id","vehicle_id","starts_at");--> statement-breakpoint
CREATE POLICY "capacity_assignments_tenant_isolation" ON "capacity_assignments" AS PERMISSIVE FOR ALL TO public USING ("capacity_assignments"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_assignments"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE capacity_assignments TO nexora_app;
