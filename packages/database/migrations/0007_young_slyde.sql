CREATE TABLE "transport_request_cargo_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"material" varchar(200) NOT NULL,
	"cargo_type" varchar(120) NOT NULL,
	"total_weight_kg" numeric(14, 3) NOT NULL,
	"volume_count" integer DEFAULT 0 NOT NULL,
	"pallet_count" integer DEFAULT 0 NOT NULL,
	"cubage_m3" numeric(14, 3),
	"max_length_m" numeric(10, 3),
	"max_width_m" numeric(10, 3),
	"max_height_m" numeric(10, 3),
	"tracking_required" boolean DEFAULT false NOT NULL,
	"vehicle_type" varchar(80) NOT NULL,
	"body_type" varchar(80) NOT NULL,
	"non_stackable" boolean DEFAULT false NOT NULL,
	"special_cargo" boolean DEFAULT false NOT NULL,
	"special_instructions" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_request_cargo_profiles_tenant_request_unique" UNIQUE("tenant_id","transport_request_id"),
	CONSTRAINT "transport_request_cargo_profiles_weight_check" CHECK ("transport_request_cargo_profiles"."total_weight_kg" > 0),
	CONSTRAINT "transport_request_cargo_profiles_volume_count_check" CHECK ("transport_request_cargo_profiles"."volume_count" >= 0),
	CONSTRAINT "transport_request_cargo_profiles_pallet_count_check" CHECK ("transport_request_cargo_profiles"."pallet_count" >= 0),
	CONSTRAINT "transport_request_cargo_profiles_package_count_check" CHECK ("transport_request_cargo_profiles"."volume_count" > 0 OR "transport_request_cargo_profiles"."pallet_count" > 0),
	CONSTRAINT "transport_request_cargo_profiles_cubage_check" CHECK ("transport_request_cargo_profiles"."cubage_m3" IS NULL OR "transport_request_cargo_profiles"."cubage_m3" > 0),
	CONSTRAINT "transport_request_cargo_profiles_dimensions_check" CHECK ((
        "transport_request_cargo_profiles"."max_length_m" IS NULL AND "transport_request_cargo_profiles"."max_width_m" IS NULL AND "transport_request_cargo_profiles"."max_height_m" IS NULL
      ) OR (
        "transport_request_cargo_profiles"."max_length_m" > 0 AND "transport_request_cargo_profiles"."max_width_m" > 0 AND "transport_request_cargo_profiles"."max_height_m" > 0
      )),
	CONSTRAINT "transport_request_cargo_profiles_material_check" CHECK (length(trim("transport_request_cargo_profiles"."material")) > 0),
	CONSTRAINT "transport_request_cargo_profiles_cargo_type_check" CHECK (length(trim("transport_request_cargo_profiles"."cargo_type")) > 0),
	CONSTRAINT "transport_request_cargo_profiles_vehicle_type_check" CHECK (length(trim("transport_request_cargo_profiles"."vehicle_type")) > 0),
	CONSTRAINT "transport_request_cargo_profiles_body_type_check" CHECK (length(trim("transport_request_cargo_profiles"."body_type")) > 0),
	CONSTRAINT "transport_request_cargo_profiles_special_instructions_check" CHECK (NOT "transport_request_cargo_profiles"."special_cargo" OR length(trim(coalesce("transport_request_cargo_profiles"."special_instructions", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "transport_request_cargo_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transport_request_cargo_profiles" ADD CONSTRAINT "transport_request_cargo_profiles_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transport_request_cargo_profiles_tenant_vehicle_idx" ON "transport_request_cargo_profiles" USING btree ("tenant_id","vehicle_type","body_type");--> statement-breakpoint
CREATE INDEX "transport_request_cargo_profiles_tenant_weight_idx" ON "transport_request_cargo_profiles" USING btree ("tenant_id","total_weight_kg");--> statement-breakpoint
CREATE POLICY "transport_request_cargo_profiles_tenant_isolation" ON "transport_request_cargo_profiles" AS PERMISSIVE FOR ALL TO public USING ("transport_request_cargo_profiles"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_request_cargo_profiles"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE transport_request_cargo_profiles TO nexora_app;
