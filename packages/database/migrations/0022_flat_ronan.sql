CREATE TYPE "public"."trip_asset_role" AS ENUM('tractor', 'vehicle', 'implement', 'support');--> statement-breakpoint
CREATE TYPE "public"."trip_driver_role" AS ENUM('primary', 'secondary', 'relief');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('planned', 'ready', 'in_transit', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trip_stop_status" AS ENUM('planned', 'arrived', 'departed', 'skipped', 'cancelled');--> statement-breakpoint
CREATE TABLE "trip_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"role" "trip_asset_role" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_assets_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "trip_assets_period_check" CHECK ("trip_assets"."ends_at" IS NULL OR "trip_assets"."ends_at" >= "trip_assets"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "trip_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"role" "trip_driver_role" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_drivers_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "trip_drivers_period_check" CHECK ("trip_drivers"."ends_at" IS NULL OR "trip_drivers"."ends_at" >= "trip_drivers"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "trip_drivers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"from_status" "trip_status",
	"to_status" "trip_status" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_status_history_transition_check" CHECK ("trip_status_history"."from_status" IS NULL OR "trip_status_history"."from_status" <> "trip_status_history"."to_status"),
	CONSTRAINT "trip_status_history_cancel_reason_check" CHECK ("trip_status_history"."to_status" <> 'cancelled' OR length(trim(coalesce("trip_status_history"."reason", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "trip_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"type" "transport_stop_type" NOT NULL,
	"location_id" uuid,
	"source_transport_request_id" uuid,
	"source_transport_request_stop_id" uuid,
	"planned_arrival_at" timestamp with time zone,
	"planned_departure_at" timestamp with time zone,
	"actual_arrival_at" timestamp with time zone,
	"actual_departure_at" timestamp with time zone,
	"status" "trip_stop_status" DEFAULT 'planned' NOT NULL,
	"instructions" varchar(1000),
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_stops_tenant_trip_id_unique" UNIQUE("tenant_id","trip_id","id"),
	CONSTRAINT "trip_stops_tenant_trip_sequence_unique" UNIQUE("tenant_id","trip_id","sequence"),
	CONSTRAINT "trip_stops_sequence_check" CHECK ("trip_stops"."sequence" > 0),
	CONSTRAINT "trip_stops_source_pair_check" CHECK (("trip_stops"."source_transport_request_id" IS NULL AND "trip_stops"."source_transport_request_stop_id" IS NULL) OR ("trip_stops"."source_transport_request_id" IS NOT NULL AND "trip_stops"."source_transport_request_stop_id" IS NOT NULL)),
	CONSTRAINT "trip_stops_source_check" CHECK ("trip_stops"."location_id" IS NOT NULL OR "trip_stops"."source_transport_request_stop_id" IS NOT NULL),
	CONSTRAINT "trip_stops_planned_window_check" CHECK ("trip_stops"."planned_departure_at" IS NULL OR "trip_stops"."planned_arrival_at" IS NULL OR "trip_stops"."planned_departure_at" >= "trip_stops"."planned_arrival_at"),
	CONSTRAINT "trip_stops_actual_window_check" CHECK ("trip_stops"."actual_departure_at" IS NULL OR ("trip_stops"."actual_arrival_at" IS NOT NULL AND "trip_stops"."actual_departure_at" >= "trip_stops"."actual_arrival_at"))
);
--> statement-breakpoint
ALTER TABLE "trip_stops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_transport_requests" (
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"transport_contract_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by_user_id" uuid,
	"remove_reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_transport_requests_pk" PRIMARY KEY("tenant_id","trip_id","transport_request_id"),
	CONSTRAINT "trip_transport_requests_sequence_check" CHECK ("trip_transport_requests"."sequence" > 0),
	CONSTRAINT "trip_transport_requests_removal_check" CHECK (("trip_transport_requests"."removed_at" IS NULL AND "trip_transport_requests"."removed_by_user_id" IS NULL AND "trip_transport_requests"."remove_reason" IS NULL) OR ("trip_transport_requests"."removed_at" IS NOT NULL AND "trip_transport_requests"."removed_by_user_id" IS NOT NULL AND length(trim(coalesce("trip_transport_requests"."remove_reason", ''))) > 0))
);
--> statement-breakpoint
ALTER TABLE "trip_transport_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"status" "trip_status" DEFAULT 'planned' NOT NULL,
	"planned_start_at" timestamp with time zone NOT NULL,
	"planned_end_at" timestamp with time zone,
	"actual_start_at" timestamp with time zone,
	"actual_end_at" timestamp with time zone,
	"origin_location_id" uuid,
	"destination_location_id" uuid,
	"notes" varchar(1000),
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "trips_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "trips_code_check" CHECK (length(trim("trips"."code")) > 0),
	CONSTRAINT "trips_planned_window_check" CHECK ("trips"."planned_end_at" IS NULL OR "trips"."planned_end_at" >= "trips"."planned_start_at"),
	CONSTRAINT "trips_actual_window_check" CHECK ("trips"."actual_end_at" IS NULL OR ("trips"."actual_start_at" IS NOT NULL AND "trips"."actual_end_at" >= "trips"."actual_start_at")),
	CONSTRAINT "trips_distinct_locations_check" CHECK ("trips"."origin_location_id" IS NULL OR "trips"."destination_location_id" IS NULL OR "trips"."origin_location_id" <> "trips"."destination_location_id")
);
--> statement-breakpoint
ALTER TABLE "trips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_assets" ADD CONSTRAINT "trip_assets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_assets" ADD CONSTRAINT "trip_assets_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_assets" ADD CONSTRAINT "trip_assets_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_assets" ADD CONSTRAINT "trip_assets_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_drivers" ADD CONSTRAINT "trip_drivers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_drivers" ADD CONSTRAINT "trip_drivers_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_drivers" ADD CONSTRAINT "trip_drivers_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_drivers" ADD CONSTRAINT "trip_drivers_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_status_history" ADD CONSTRAINT "trip_status_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_status_history" ADD CONSTRAINT "trip_status_history_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_location_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_trip_request_fk" FOREIGN KEY ("tenant_id","trip_id","source_transport_request_id") REFERENCES "public"."trip_transport_requests"("tenant_id","trip_id","transport_request_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_source_stop_fk" FOREIGN KEY ("tenant_id","source_transport_request_id","source_transport_request_stop_id") REFERENCES "public"."transport_request_stops"("tenant_id","transport_request_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_transport_requests" ADD CONSTRAINT "trip_transport_requests_removed_by_user_id_users_id_fk" FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_transport_requests" ADD CONSTRAINT "trip_transport_requests_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_transport_requests" ADD CONSTRAINT "trip_transport_requests_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_transport_requests" ADD CONSTRAINT "trip_transport_requests_contract_fk" FOREIGN KEY ("tenant_id","transport_request_id","transport_contract_id") REFERENCES "public"."transport_contracts"("tenant_id","transport_request_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_origin_location_fk" FOREIGN KEY ("tenant_id","origin_location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_destination_location_fk" FOREIGN KEY ("tenant_id","destination_location_id") REFERENCES "public"."locations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_assets_active_asset_unique" ON "trip_assets" USING btree ("tenant_id","trip_id","asset_id") WHERE "trip_assets"."ends_at" IS NULL;--> statement-breakpoint
CREATE INDEX "trip_assets_tenant_asset_period_idx" ON "trip_assets" USING btree ("tenant_id","asset_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_drivers_active_driver_unique" ON "trip_drivers" USING btree ("tenant_id","trip_id","driver_id") WHERE "trip_drivers"."ends_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_drivers_active_primary_unique" ON "trip_drivers" USING btree ("tenant_id","trip_id","role") WHERE "trip_drivers"."ends_at" IS NULL AND "trip_drivers"."role" = 'primary';--> statement-breakpoint
CREATE INDEX "trip_drivers_tenant_driver_period_idx" ON "trip_drivers" USING btree ("tenant_id","driver_id","starts_at");--> statement-breakpoint
CREATE INDEX "trip_status_history_tenant_trip_created_idx" ON "trip_status_history" USING btree ("tenant_id","trip_id","created_at");--> statement-breakpoint
CREATE INDEX "trip_stops_tenant_trip_status_idx" ON "trip_stops" USING btree ("tenant_id","trip_id","status","sequence");--> statement-breakpoint
CREATE INDEX "trip_stops_tenant_location_idx" ON "trip_stops" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_transport_requests_active_sequence_unique" ON "trip_transport_requests" USING btree ("tenant_id","trip_id","sequence") WHERE "trip_transport_requests"."removed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_transport_requests_active_request_unique" ON "trip_transport_requests" USING btree ("tenant_id","transport_request_id") WHERE "trip_transport_requests"."removed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_transport_requests_active_contract_unique" ON "trip_transport_requests" USING btree ("tenant_id","transport_contract_id") WHERE "trip_transport_requests"."removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "trip_transport_requests_request_idx" ON "trip_transport_requests" USING btree ("tenant_id","transport_request_id","created_at");--> statement-breakpoint
CREATE INDEX "trip_transport_requests_contract_idx" ON "trip_transport_requests" USING btree ("tenant_id","transport_contract_id");--> statement-breakpoint
CREATE INDEX "trips_tenant_status_start_idx" ON "trips" USING btree ("tenant_id","status","planned_start_at");--> statement-breakpoint
CREATE INDEX "trips_tenant_origin_idx" ON "trips" USING btree ("tenant_id","origin_location_id");--> statement-breakpoint
CREATE INDEX "trips_tenant_destination_idx" ON "trips" USING btree ("tenant_id","destination_location_id");--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_tenant_request_id_unique" UNIQUE("tenant_id","transport_request_id","id");--> statement-breakpoint
CREATE POLICY "trip_assets_tenant_isolation" ON "trip_assets" AS PERMISSIVE FOR ALL TO public USING ("trip_assets"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_assets"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_drivers_tenant_isolation" ON "trip_drivers" AS PERMISSIVE FOR ALL TO public USING ("trip_drivers"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_drivers"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_status_history_tenant_isolation" ON "trip_status_history" AS PERMISSIVE FOR ALL TO public USING ("trip_status_history"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_status_history"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_stops_tenant_isolation" ON "trip_stops" AS PERMISSIVE FOR ALL TO public USING ("trip_stops"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_stops"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_transport_requests_tenant_isolation" ON "trip_transport_requests" AS PERMISSIVE FOR ALL TO public USING ("trip_transport_requests"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_transport_requests"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trips_tenant_isolation" ON "trips" AS PERMISSIVE FOR ALL TO public USING ("trips"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trips"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);GRANT SELECT, INSERT, UPDATE ON trips TO nexora_app;
GRANT SELECT, INSERT, UPDATE ON trip_transport_requests TO nexora_app;
GRANT SELECT, INSERT, UPDATE ON trip_stops TO nexora_app;
GRANT SELECT, INSERT, UPDATE ON trip_drivers TO nexora_app;
GRANT SELECT, INSERT, UPDATE ON trip_assets TO nexora_app;
GRANT SELECT, INSERT ON trip_status_history TO nexora_app;
