CREATE TYPE "public"."capacity_asset_kind" AS ENUM('vehicle', 'implement');--> statement-breakpoint
CREATE TYPE "public"."capacity_asset_status" AS ENUM('active', 'blocked', 'inactive');--> statement-breakpoint
CREATE TABLE "capacity_asset_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"change_type" varchar(32) NOT NULL,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capacity_asset_audit_change_type_check" CHECK ("capacity_asset_audit"."change_type" in ('created','updated','status_changed'))
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"carrier_party_id" uuid,
	"owner_party_id" uuid,
	"owner_name" varchar(180),
	"asset_kind" "capacity_asset_kind" NOT NULL,
	"identifier" varchar(64) NOT NULL,
	"plate" varchar(7),
	"vehicle_type" varchar(80) NOT NULL,
	"body_type" varchar(80) NOT NULL,
	"capacity_weight_kg" numeric(12, 3) NOT NULL,
	"capacity_volume_m3" numeric(12, 3),
	"max_length_m" numeric(8, 3),
	"max_width_m" numeric(8, 3),
	"max_height_m" numeric(8, 3),
	"tracking_available" boolean DEFAULT false NOT NULL,
	"status" "capacity_asset_status" DEFAULT 'inactive' NOT NULL,
	"status_reason" varchar(500),
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capacity_assets_tenant_identifier_unique" UNIQUE("tenant_id","identifier"),
	CONSTRAINT "capacity_assets_tenant_plate_unique" UNIQUE("tenant_id","plate"),
	CONSTRAINT "capacity_assets_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_assets_identifier_check" CHECK (length(trim("capacity_assets"."identifier")) >= 2),
	CONSTRAINT "capacity_assets_plate_check" CHECK ("capacity_assets"."plate" IS NULL OR "capacity_assets"."plate" ~ '^([A-Z]{3}[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2})$'),
	CONSTRAINT "capacity_assets_vehicle_type_check" CHECK (length(trim("capacity_assets"."vehicle_type")) >= 2),
	CONSTRAINT "capacity_assets_body_type_check" CHECK (length(trim("capacity_assets"."body_type")) >= 2),
	CONSTRAINT "capacity_assets_weight_check" CHECK ("capacity_assets"."capacity_weight_kg" > 0),
	CONSTRAINT "capacity_assets_volume_check" CHECK ("capacity_assets"."capacity_volume_m3" IS NULL OR "capacity_assets"."capacity_volume_m3" > 0),
	CONSTRAINT "capacity_assets_dimensions_check" CHECK ((
        "capacity_assets"."max_length_m" IS NULL AND "capacity_assets"."max_width_m" IS NULL AND "capacity_assets"."max_height_m" IS NULL
      ) OR (
        "capacity_assets"."max_length_m" > 0 AND "capacity_assets"."max_width_m" > 0 AND "capacity_assets"."max_height_m" > 0
      )),
	CONSTRAINT "capacity_assets_owner_check" CHECK ("capacity_assets"."carrier_party_id" IS NOT NULL OR "capacity_assets"."owner_party_id" IS NOT NULL OR length(trim(coalesce("capacity_assets"."owner_name", ''))) >= 3),
	CONSTRAINT "capacity_assets_status_reason_check" CHECK ("capacity_assets"."status" <> 'blocked' OR "capacity_assets"."status_reason" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "capacity_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "capacity_asset_audit" ADD CONSTRAINT "capacity_asset_audit_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_audit" ADD CONSTRAINT "capacity_asset_audit_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_assets" ADD CONSTRAINT "capacity_assets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_assets" ADD CONSTRAINT "capacity_assets_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_assets" ADD CONSTRAINT "capacity_assets_carrier_party_fk" FOREIGN KEY ("tenant_id","carrier_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_assets" ADD CONSTRAINT "capacity_assets_owner_party_fk" FOREIGN KEY ("tenant_id","owner_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capacity_asset_audit_tenant_asset_idx" ON "capacity_asset_audit" USING btree ("tenant_id","asset_id","created_at");--> statement-breakpoint
CREATE INDEX "capacity_assets_tenant_status_idx" ON "capacity_assets" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "capacity_assets_tenant_carrier_idx" ON "capacity_assets" USING btree ("tenant_id","carrier_party_id");--> statement-breakpoint
CREATE INDEX "capacity_assets_tenant_vehicle_body_idx" ON "capacity_assets" USING btree ("tenant_id","vehicle_type","body_type");--> statement-breakpoint
CREATE INDEX "capacity_assets_tenant_tracking_idx" ON "capacity_assets" USING btree ("tenant_id","tracking_available");--> statement-breakpoint
CREATE POLICY "capacity_asset_audit_tenant_isolation" ON "capacity_asset_audit" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_audit"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_audit"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_assets_tenant_isolation" ON "capacity_assets" AS PERMISSIVE FOR ALL TO public USING ("capacity_assets"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_assets"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE capacity_assets TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE capacity_asset_audit TO nexora_app;
