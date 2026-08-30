CREATE TABLE "freight_lanes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(180) NOT NULL,
	"origin_city_id" uuid NOT NULL,
	"destination_city_id" uuid NOT NULL,
	"origin_radius_km" numeric(10, 2),
	"destination_radius_km" numeric(10, 2),
	"distance_km" numeric(12, 2),
	"typical_transit_hours" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "freight_lanes_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "freight_lanes_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "freight_lanes_code_check" CHECK (length(trim("freight_lanes"."code")) > 0),
	CONSTRAINT "freight_lanes_name_check" CHECK (length(trim("freight_lanes"."name")) > 0),
	CONSTRAINT "freight_lanes_distinct_cities_check" CHECK ("freight_lanes"."origin_city_id" <> "freight_lanes"."destination_city_id"),
	CONSTRAINT "freight_lanes_origin_radius_check" CHECK ("freight_lanes"."origin_radius_km" IS NULL OR "freight_lanes"."origin_radius_km" >= 0),
	CONSTRAINT "freight_lanes_destination_radius_check" CHECK ("freight_lanes"."destination_radius_km" IS NULL OR "freight_lanes"."destination_radius_km" >= 0),
	CONSTRAINT "freight_lanes_distance_check" CHECK ("freight_lanes"."distance_km" IS NULL OR "freight_lanes"."distance_km" > 0),
	CONSTRAINT "freight_lanes_transit_check" CHECK ("freight_lanes"."typical_transit_hours" IS NULL OR "freight_lanes"."typical_transit_hours" > 0)
);
--> statement-breakpoint
ALTER TABLE "freight_lanes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"source" varchar(32) DEFAULT 'system' NOT NULL,
	"actor_user_id" uuid,
	"correlation_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_request_events_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "transport_request_events_type_check" CHECK (length(trim("transport_request_events"."event_type")) > 0),
	CONSTRAINT "transport_request_events_source_check" CHECK ("transport_request_events"."source" in ('user','system','integration','worker'))
);
--> statement-breakpoint
ALTER TABLE "transport_request_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"commodity_id" uuid,
	"cargo_type_id" uuid,
	"sku" varchar(120),
	"description" varchar(500) NOT NULL,
	"quantity" numeric(14, 3) DEFAULT '1' NOT NULL,
	"unit_of_measure_id" uuid,
	"total_weight_kg" numeric(14, 3),
	"total_volume_m3" numeric(14, 3),
	"hazardous" boolean DEFAULT false NOT NULL,
	"min_temperature_c" numeric(6, 2),
	"max_temperature_c" numeric(6, 2),
	"stackable" boolean,
	"notes" varchar(1000),
	CONSTRAINT "transport_request_items_tenant_request_id_unique" UNIQUE("tenant_id","transport_request_id","id"),
	CONSTRAINT "transport_request_items_tenant_request_sequence_unique" UNIQUE("tenant_id","transport_request_id","sequence"),
	CONSTRAINT "transport_request_items_sequence_check" CHECK ("transport_request_items"."sequence" > 0),
	CONSTRAINT "transport_request_items_description_check" CHECK (length(trim("transport_request_items"."description")) > 0),
	CONSTRAINT "transport_request_items_quantity_check" CHECK ("transport_request_items"."quantity" > 0),
	CONSTRAINT "transport_request_items_weight_check" CHECK ("transport_request_items"."total_weight_kg" IS NULL OR "transport_request_items"."total_weight_kg" > 0),
	CONSTRAINT "transport_request_items_volume_check" CHECK ("transport_request_items"."total_volume_m3" IS NULL OR "transport_request_items"."total_volume_m3" > 0),
	CONSTRAINT "transport_request_items_temperature_check" CHECK ("transport_request_items"."min_temperature_c" IS NULL OR "transport_request_items"."max_temperature_c" IS NULL OR "transport_request_items"."min_temperature_c" <= "transport_request_items"."max_temperature_c")
);
--> statement-breakpoint
ALTER TABLE "transport_request_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_request_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"item_id" uuid,
	"sequence" integer NOT NULL,
	"package_type_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"weight_kg" numeric(14, 3),
	"length_m" numeric(10, 3),
	"width_m" numeric(10, 3),
	"height_m" numeric(10, 3),
	"stackable" boolean,
	"label" varchar(160),
	"barcode" varchar(160),
	"notes" varchar(1000),
	CONSTRAINT "transport_request_packages_tenant_request_id_unique" UNIQUE("tenant_id","transport_request_id","id"),
	CONSTRAINT "transport_request_packages_tenant_request_sequence_unique" UNIQUE("tenant_id","transport_request_id","sequence"),
	CONSTRAINT "transport_request_packages_sequence_check" CHECK ("transport_request_packages"."sequence" > 0),
	CONSTRAINT "transport_request_packages_quantity_check" CHECK ("transport_request_packages"."quantity" > 0),
	CONSTRAINT "transport_request_packages_weight_check" CHECK ("transport_request_packages"."weight_kg" IS NULL OR "transport_request_packages"."weight_kg" > 0),
	CONSTRAINT "transport_request_packages_dimensions_check" CHECK ((
        "transport_request_packages"."length_m" IS NULL AND "transport_request_packages"."width_m" IS NULL AND "transport_request_packages"."height_m" IS NULL
      ) OR (
        "transport_request_packages"."length_m" > 0 AND "transport_request_packages"."width_m" > 0 AND "transport_request_packages"."height_m" > 0
      ))
);
--> statement-breakpoint
ALTER TABLE "transport_request_packages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_request_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"reference_type" varchar(32) NOT NULL,
	"value" varchar(180) NOT NULL,
	"issuer_party_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "transport_request_references_tenant_request_type_value_unique" UNIQUE("tenant_id","transport_request_id","reference_type","value"),
	CONSTRAINT "transport_request_references_type_check" CHECK ("transport_request_references"."reference_type" in ('customer_order','purchase_order','invoice','shipment','booking','tracking','external','other')),
	CONSTRAINT "transport_request_references_value_check" CHECK (length(trim("transport_request_references"."value")) > 0)
);
--> statement-breakpoint
ALTER TABLE "transport_request_references" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_request_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"requirement_type" varchar(32) NOT NULL,
	"vehicle_type_id" uuid,
	"body_type_id" uuid,
	"required" boolean DEFAULT true NOT NULL,
	"value_text" varchar(500),
	"value_numeric" numeric(14, 3),
	"value_boolean" boolean,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" varchar(1000),
	CONSTRAINT "transport_request_requirements_tenant_request_code_unique" UNIQUE("tenant_id","transport_request_id","code"),
	CONSTRAINT "transport_request_requirements_code_check" CHECK (length(trim("transport_request_requirements"."code")) > 0),
	CONSTRAINT "transport_request_requirements_type_check" CHECK ("transport_request_requirements"."requirement_type" in ('vehicle_type','body_type','tracking','temperature_min','temperature_max','handling','certification','equipment','insurance','other')),
	CONSTRAINT "transport_request_requirements_vehicle_type_check" CHECK ("transport_request_requirements"."requirement_type" <> 'vehicle_type' OR ("transport_request_requirements"."vehicle_type_id" IS NOT NULL AND "transport_request_requirements"."body_type_id" IS NULL)),
	CONSTRAINT "transport_request_requirements_body_type_check" CHECK ("transport_request_requirements"."requirement_type" <> 'body_type' OR ("transport_request_requirements"."body_type_id" IS NOT NULL AND "transport_request_requirements"."vehicle_type_id" IS NULL)),
	CONSTRAINT "transport_request_requirements_tracking_check" CHECK ("transport_request_requirements"."requirement_type" <> 'tracking' OR "transport_request_requirements"."value_boolean" IS NOT NULL),
	CONSTRAINT "transport_request_requirements_temperature_check" CHECK ("transport_request_requirements"."requirement_type" NOT IN ('temperature_min','temperature_max') OR "transport_request_requirements"."value_numeric" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "transport_request_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_request_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"from_status" "transport_request_status",
	"to_status" "transport_request_status" NOT NULL,
	"reason" varchar(1000),
	"actor_user_id" uuid NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_request_status_history_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "transport_request_status_history_transition_check" CHECK ("transport_request_status_history"."from_status" IS NULL OR "transport_request_status_history"."from_status" <> "transport_request_status_history"."to_status")
);
--> statement-breakpoint
ALTER TABLE "transport_request_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "freight_lanes" ADD CONSTRAINT "freight_lanes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_lanes" ADD CONSTRAINT "freight_lanes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_lanes" ADD CONSTRAINT "freight_lanes_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_lanes" ADD CONSTRAINT "freight_lanes_origin_city_id_cities_id_fk" FOREIGN KEY ("origin_city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_lanes" ADD CONSTRAINT "freight_lanes_destination_city_id_cities_id_fk" FOREIGN KEY ("destination_city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_events" ADD CONSTRAINT "transport_request_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_events" ADD CONSTRAINT "transport_request_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_events" ADD CONSTRAINT "transport_request_events_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_items" ADD CONSTRAINT "transport_request_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_items" ADD CONSTRAINT "transport_request_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_items" ADD CONSTRAINT "transport_request_items_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_items" ADD CONSTRAINT "transport_request_items_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_items" ADD CONSTRAINT "transport_request_items_commodity_fk" FOREIGN KEY ("tenant_id","commodity_id") REFERENCES "public"."commodities"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_items" ADD CONSTRAINT "transport_request_items_cargo_type_fk" FOREIGN KEY ("tenant_id","cargo_type_id") REFERENCES "public"."cargo_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_items" ADD CONSTRAINT "transport_request_items_uom_fk" FOREIGN KEY ("unit_of_measure_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_packages" ADD CONSTRAINT "transport_request_packages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_packages" ADD CONSTRAINT "transport_request_packages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_packages" ADD CONSTRAINT "transport_request_packages_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_packages" ADD CONSTRAINT "transport_request_packages_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_packages" ADD CONSTRAINT "transport_request_packages_item_fk" FOREIGN KEY ("tenant_id","transport_request_id","item_id") REFERENCES "public"."transport_request_items"("tenant_id","transport_request_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_packages" ADD CONSTRAINT "transport_request_packages_package_type_fk" FOREIGN KEY ("tenant_id","package_type_id") REFERENCES "public"."package_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_references" ADD CONSTRAINT "transport_request_references_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_references" ADD CONSTRAINT "transport_request_references_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_references" ADD CONSTRAINT "transport_request_references_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_references" ADD CONSTRAINT "transport_request_references_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_references" ADD CONSTRAINT "transport_request_references_issuer_party_fk" FOREIGN KEY ("tenant_id","issuer_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_requirements" ADD CONSTRAINT "transport_request_requirements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_requirements" ADD CONSTRAINT "transport_request_requirements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_requirements" ADD CONSTRAINT "transport_request_requirements_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_requirements" ADD CONSTRAINT "transport_request_requirements_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_requirements" ADD CONSTRAINT "transport_request_requirements_vehicle_type_fk" FOREIGN KEY ("tenant_id","vehicle_type_id") REFERENCES "public"."vehicle_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_requirements" ADD CONSTRAINT "transport_request_requirements_body_type_fk" FOREIGN KEY ("tenant_id","body_type_id") REFERENCES "public"."body_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_status_history" ADD CONSTRAINT "transport_request_status_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_status_history" ADD CONSTRAINT "transport_request_status_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_status_history" ADD CONSTRAINT "transport_request_status_history_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "freight_lanes_tenant_route_active_idx" ON "freight_lanes" USING btree ("tenant_id","origin_city_id","destination_city_id","is_active");--> statement-breakpoint
CREATE INDEX "transport_request_events_tenant_request_occurred_idx" ON "transport_request_events" USING btree ("tenant_id","transport_request_id","occurred_at");--> statement-breakpoint
CREATE INDEX "transport_request_events_tenant_type_occurred_idx" ON "transport_request_events" USING btree ("tenant_id","event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "transport_request_items_tenant_request_idx" ON "transport_request_items" USING btree ("tenant_id","transport_request_id");--> statement-breakpoint
CREATE INDEX "transport_request_items_tenant_commodity_idx" ON "transport_request_items" USING btree ("tenant_id","commodity_id");--> statement-breakpoint
CREATE INDEX "transport_request_packages_tenant_request_idx" ON "transport_request_packages" USING btree ("tenant_id","transport_request_id");--> statement-breakpoint
CREATE INDEX "transport_request_packages_tenant_item_idx" ON "transport_request_packages" USING btree ("tenant_id","item_id");--> statement-breakpoint
CREATE INDEX "transport_request_references_tenant_request_type_idx" ON "transport_request_references" USING btree ("tenant_id","transport_request_id","reference_type");--> statement-breakpoint
CREATE INDEX "transport_request_requirements_tenant_request_type_idx" ON "transport_request_requirements" USING btree ("tenant_id","transport_request_id","requirement_type");--> statement-breakpoint
CREATE INDEX "transport_request_status_history_tenant_request_created_idx" ON "transport_request_status_history" USING btree ("tenant_id","transport_request_id","created_at");--> statement-breakpoint
CREATE POLICY "freight_lanes_tenant_isolation" ON "freight_lanes" AS PERMISSIVE FOR ALL TO public USING ("freight_lanes"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("freight_lanes"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "transport_request_events_tenant_isolation" ON "transport_request_events" AS PERMISSIVE FOR ALL TO public USING ("transport_request_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_request_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "transport_request_items_tenant_isolation" ON "transport_request_items" AS PERMISSIVE FOR ALL TO public USING ("transport_request_items"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_request_items"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "transport_request_packages_tenant_isolation" ON "transport_request_packages" AS PERMISSIVE FOR ALL TO public USING ("transport_request_packages"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_request_packages"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "transport_request_references_tenant_isolation" ON "transport_request_references" AS PERMISSIVE FOR ALL TO public USING ("transport_request_references"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_request_references"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "transport_request_requirements_tenant_isolation" ON "transport_request_requirements" AS PERMISSIVE FOR ALL TO public USING ("transport_request_requirements"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_request_requirements"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "transport_request_status_history_tenant_isolation" ON "transport_request_status_history" AS PERMISSIVE FOR ALL TO public USING ("transport_request_status_history"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_request_status_history"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE transport_request_items, transport_request_packages, transport_request_requirements, transport_request_references TO nexora_app;
GRANT SELECT, INSERT, UPDATE ON TABLE freight_lanes TO nexora_app;
GRANT SELECT, INSERT ON TABLE transport_request_status_history, transport_request_events TO nexora_app;
