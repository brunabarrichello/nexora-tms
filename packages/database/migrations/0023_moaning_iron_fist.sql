CREATE TABLE "trip_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_stop_id" uuid NOT NULL,
	"checkin_type" varchar(24) NOT NULL,
	"source" varchar(24) DEFAULT 'manual' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"notes" varchar(1000),
	"actor_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_checkins_tenant_trip_id_unique" UNIQUE("tenant_id","trip_id","id"),
	CONSTRAINT "trip_checkins_type_check" CHECK ("trip_checkins"."checkin_type" in ('arrival','departure','pickup','delivery','checkpoint')),
	CONSTRAINT "trip_checkins_source_check" CHECK ("trip_checkins"."source" in ('manual','mobile','gps','integration')),
	CONSTRAINT "trip_checkins_coordinates_pair_check" CHECK (("trip_checkins"."latitude" IS NULL AND "trip_checkins"."longitude" IS NULL) OR ("trip_checkins"."latitude" IS NOT NULL AND "trip_checkins"."longitude" IS NOT NULL)),
	CONSTRAINT "trip_checkins_latitude_check" CHECK ("trip_checkins"."latitude" IS NULL OR ("trip_checkins"."latitude" >= -90 AND "trip_checkins"."latitude" <= 90)),
	CONSTRAINT "trip_checkins_longitude_check" CHECK ("trip_checkins"."longitude" IS NULL OR ("trip_checkins"."longitude" >= -180 AND "trip_checkins"."longitude" <= 180))
);
--> statement-breakpoint
ALTER TABLE "trip_checkins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_stop_id" uuid,
	"category" varchar(40) NOT NULL,
	"item_code" varchar(80) NOT NULL,
	"label" varchar(240) NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"waiver_reason" varchar(1000),
	"notes" varchar(1000),
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_checklists_tenant_trip_id_unique" UNIQUE("tenant_id","trip_id","id"),
	CONSTRAINT "trip_checklists_category_check" CHECK (length(trim("trip_checklists"."category")) > 0),
	CONSTRAINT "trip_checklists_item_code_check" CHECK (length(trim("trip_checklists"."item_code")) > 0),
	CONSTRAINT "trip_checklists_label_check" CHECK (length(trim("trip_checklists"."label")) > 0),
	CONSTRAINT "trip_checklists_status_check" CHECK ("trip_checklists"."status" in ('pending','completed','waived','failed')),
	CONSTRAINT "trip_checklists_completion_check" CHECK (("trip_checklists"."status" = 'pending' AND "trip_checklists"."completed_at" IS NULL AND "trip_checklists"."completed_by_user_id" IS NULL) OR ("trip_checklists"."status" <> 'pending' AND "trip_checklists"."completed_at" IS NOT NULL AND "trip_checklists"."completed_by_user_id" IS NOT NULL)),
	CONSTRAINT "trip_checklists_waiver_check" CHECK ("trip_checklists"."status" <> 'waived' OR length(trim(coalesce("trip_checklists"."waiver_reason", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "trip_checklists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_delivery_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_stop_id" uuid NOT NULL,
	"trip_proof_id" uuid NOT NULL,
	"received_by_name" varchar(180) NOT NULL,
	"received_by_role" varchar(120),
	"delivered_at" timestamp with time zone NOT NULL,
	"status" varchar(24) DEFAULT 'recorded' NOT NULL,
	"exception_reason" varchar(1000),
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_delivery_proofs_tenant_trip_id_unique" UNIQUE("tenant_id","trip_id","id"),
	CONSTRAINT "trip_delivery_proofs_tenant_trip_proof_unique" UNIQUE("tenant_id","trip_id","trip_proof_id"),
	CONSTRAINT "trip_delivery_proofs_receiver_check" CHECK (length(trim("trip_delivery_proofs"."received_by_name")) > 0),
	CONSTRAINT "trip_delivery_proofs_status_check" CHECK ("trip_delivery_proofs"."status" in ('recorded','accepted','rejected')),
	CONSTRAINT "trip_delivery_proofs_exception_check" CHECK ("trip_delivery_proofs"."status" <> 'rejected' OR length(trim(coalesce("trip_delivery_proofs"."exception_reason", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "trip_delivery_proofs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_stop_id" uuid,
	"document_id" uuid NOT NULL,
	"relation_type" varchar(32) DEFAULT 'execution' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_documents_tenant_trip_id_unique" UNIQUE("tenant_id","trip_id","id"),
	CONSTRAINT "trip_documents_tenant_trip_document_relation_unique" UNIQUE("tenant_id","trip_id","document_id","relation_type"),
	CONSTRAINT "trip_documents_relation_check" CHECK ("trip_documents"."relation_type" in ('execution','pickup_proof','delivery_proof','expense_receipt','toll_receipt','fuel_receipt','checklist_evidence','other'))
);
--> statement-breakpoint
ALTER TABLE "trip_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_stop_id" uuid,
	"event_type" varchar(40) NOT NULL,
	"source" varchar(24) DEFAULT 'manual' NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" varchar(1500),
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_events_tenant_trip_id_unique" UNIQUE("tenant_id","trip_id","id"),
	CONSTRAINT "trip_events_type_check" CHECK ("trip_events"."event_type" in ('dispatch','departure','arrival','pickup','delivery','checkpoint','delay','status_change','note','system')),
	CONSTRAINT "trip_events_source_check" CHECK ("trip_events"."source" in ('manual','mobile','system','integration')),
	CONSTRAINT "trip_events_title_check" CHECK (length(trim("trip_events"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "trip_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_stop_id" uuid,
	"trip_document_id" uuid,
	"category" varchar(32) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency_id" uuid NOT NULL,
	"incurred_at" timestamp with time zone NOT NULL,
	"merchant" varchar(180),
	"external_reference" varchar(180),
	"description" varchar(1000),
	"status" varchar(24) DEFAULT 'reported' NOT NULL,
	"reported_by_user_id" uuid NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_expenses_tenant_trip_id_unique" UNIQUE("tenant_id","trip_id","id"),
	CONSTRAINT "trip_expenses_category_check" CHECK ("trip_expenses"."category" in ('parking','meal','lodging','repair','loading','unloading','other')),
	CONSTRAINT "trip_expenses_amount_check" CHECK ("trip_expenses"."amount" > 0),
	CONSTRAINT "trip_expenses_status_check" CHECK ("trip_expenses"."status" in ('reported','approved','rejected','voided')),
	CONSTRAINT "trip_expenses_review_check" CHECK (("trip_expenses"."status" = 'reported' AND "trip_expenses"."reviewed_by_user_id" IS NULL AND "trip_expenses"."reviewed_at" IS NULL) OR ("trip_expenses"."status" <> 'reported' AND "trip_expenses"."reviewed_by_user_id" IS NOT NULL AND "trip_expenses"."reviewed_at" IS NOT NULL)),
	CONSTRAINT "trip_expenses_rejection_reason_check" CHECK ("trip_expenses"."status" NOT IN ('rejected','voided') OR length(trim(coalesce("trip_expenses"."review_reason", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "trip_expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_fuel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_stop_id" uuid,
	"trip_document_id" uuid,
	"fuel_type" varchar(24) NOT NULL,
	"liters" numeric(12, 3) NOT NULL,
	"unit_price" numeric(14, 4) NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"currency_id" uuid NOT NULL,
	"odometer_km" numeric(14, 1),
	"station" varchar(180),
	"fueled_at" timestamp with time zone NOT NULL,
	"notes" varchar(1000),
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_fuel_tenant_trip_id_unique" UNIQUE("tenant_id","trip_id","id"),
	CONSTRAINT "trip_fuel_type_check" CHECK ("trip_fuel"."fuel_type" in ('diesel','gasoline','ethanol','cng','electric','other')),
	CONSTRAINT "trip_fuel_liters_check" CHECK ("trip_fuel"."liters" > 0),
	CONSTRAINT "trip_fuel_unit_price_check" CHECK ("trip_fuel"."unit_price" > 0),
	CONSTRAINT "trip_fuel_total_amount_check" CHECK ("trip_fuel"."total_amount" > 0),
	CONSTRAINT "trip_fuel_odometer_check" CHECK ("trip_fuel"."odometer_km" IS NULL OR "trip_fuel"."odometer_km" >= 0)
);
--> statement-breakpoint
ALTER TABLE "trip_fuel" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_stop_id" uuid,
	"source" varchar(24) NOT NULL,
	"provider" varchar(80),
	"provider_event_id" varchar(180),
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"accuracy_m" numeric(10, 2),
	"speed_kmh" numeric(10, 2),
	"heading_degrees" numeric(6, 2),
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_locations_tenant_trip_id_unique" UNIQUE("tenant_id","trip_id","id"),
	CONSTRAINT "trip_locations_source_check" CHECK ("trip_locations"."source" in ('manual','mobile','gps','integration')),
	CONSTRAINT "trip_locations_provider_check" CHECK ("trip_locations"."source" <> 'integration' OR length(trim(coalesce("trip_locations"."provider", ''))) > 0),
	CONSTRAINT "trip_locations_latitude_check" CHECK ("trip_locations"."latitude" >= -90 AND "trip_locations"."latitude" <= 90),
	CONSTRAINT "trip_locations_longitude_check" CHECK ("trip_locations"."longitude" >= -180 AND "trip_locations"."longitude" <= 180),
	CONSTRAINT "trip_locations_accuracy_check" CHECK ("trip_locations"."accuracy_m" IS NULL OR "trip_locations"."accuracy_m" >= 0),
	CONSTRAINT "trip_locations_speed_check" CHECK ("trip_locations"."speed_kmh" IS NULL OR "trip_locations"."speed_kmh" >= 0),
	CONSTRAINT "trip_locations_heading_check" CHECK ("trip_locations"."heading_degrees" IS NULL OR ("trip_locations"."heading_degrees" >= 0 AND "trip_locations"."heading_degrees" < 360)),
	CONSTRAINT "trip_locations_received_check" CHECK ("trip_locations"."received_at" >= "trip_locations"."recorded_at")
);
--> statement-breakpoint
ALTER TABLE "trip_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_stop_id" uuid,
	"trip_document_id" uuid NOT NULL,
	"proof_type" varchar(32) NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"captured_by_user_id" uuid,
	"source" varchar(24) DEFAULT 'manual' NOT NULL,
	"notes" varchar(1000),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_proofs_tenant_trip_id_unique" UNIQUE("tenant_id","trip_id","id"),
	CONSTRAINT "trip_proofs_type_check" CHECK ("trip_proofs"."proof_type" in ('pickup','delivery','seal','weight','checklist','other')),
	CONSTRAINT "trip_proofs_source_check" CHECK ("trip_proofs"."source" in ('manual','mobile','integration','generated'))
);
--> statement-breakpoint
ALTER TABLE "trip_proofs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_tolls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_stop_id" uuid,
	"trip_document_id" uuid,
	"plaza" varchar(180) NOT NULL,
	"road" varchar(120),
	"amount" numeric(14, 2) NOT NULL,
	"currency_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payment_method" varchar(24) NOT NULL,
	"tag_reference" varchar(120),
	"notes" varchar(1000),
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_tolls_tenant_trip_id_unique" UNIQUE("tenant_id","trip_id","id"),
	CONSTRAINT "trip_tolls_plaza_check" CHECK (length(trim("trip_tolls"."plaza")) > 0),
	CONSTRAINT "trip_tolls_amount_check" CHECK ("trip_tolls"."amount" > 0),
	CONSTRAINT "trip_tolls_payment_method_check" CHECK ("trip_tolls"."payment_method" in ('cash','tag','card','invoice','other'))
);
--> statement-breakpoint
ALTER TABLE "trip_tolls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_checkins" ADD CONSTRAINT "trip_checkins_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_checkins" ADD CONSTRAINT "trip_checkins_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_checkins" ADD CONSTRAINT "trip_checkins_stop_fk" FOREIGN KEY ("tenant_id","trip_id","trip_stop_id") REFERENCES "public"."trip_stops"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_checklists" ADD CONSTRAINT "trip_checklists_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_checklists" ADD CONSTRAINT "trip_checklists_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_checklists" ADD CONSTRAINT "trip_checklists_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_checklists" ADD CONSTRAINT "trip_checklists_stop_fk" FOREIGN KEY ("tenant_id","trip_id","trip_stop_id") REFERENCES "public"."trip_stops"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_delivery_proofs" ADD CONSTRAINT "trip_delivery_proofs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_delivery_proofs" ADD CONSTRAINT "trip_delivery_proofs_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_delivery_proofs" ADD CONSTRAINT "trip_delivery_proofs_stop_fk" FOREIGN KEY ("tenant_id","trip_id","trip_stop_id") REFERENCES "public"."trip_stops"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_delivery_proofs" ADD CONSTRAINT "trip_delivery_proofs_proof_fk" FOREIGN KEY ("tenant_id","trip_id","trip_proof_id") REFERENCES "public"."trip_proofs"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_documents" ADD CONSTRAINT "trip_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_documents" ADD CONSTRAINT "trip_documents_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_documents" ADD CONSTRAINT "trip_documents_stop_fk" FOREIGN KEY ("tenant_id","trip_id","trip_stop_id") REFERENCES "public"."trip_stops"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_documents" ADD CONSTRAINT "trip_documents_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_stop_fk" FOREIGN KEY ("tenant_id","trip_id","trip_stop_id") REFERENCES "public"."trip_stops"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_stop_fk" FOREIGN KEY ("tenant_id","trip_id","trip_stop_id") REFERENCES "public"."trip_stops"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_document_fk" FOREIGN KEY ("tenant_id","trip_id","trip_document_id") REFERENCES "public"."trip_documents"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_fuel" ADD CONSTRAINT "trip_fuel_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_fuel" ADD CONSTRAINT "trip_fuel_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_fuel" ADD CONSTRAINT "trip_fuel_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_fuel" ADD CONSTRAINT "trip_fuel_stop_fk" FOREIGN KEY ("tenant_id","trip_id","trip_stop_id") REFERENCES "public"."trip_stops"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_fuel" ADD CONSTRAINT "trip_fuel_document_fk" FOREIGN KEY ("tenant_id","trip_id","trip_document_id") REFERENCES "public"."trip_documents"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_locations" ADD CONSTRAINT "trip_locations_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_locations" ADD CONSTRAINT "trip_locations_stop_fk" FOREIGN KEY ("tenant_id","trip_id","trip_stop_id") REFERENCES "public"."trip_stops"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_proofs" ADD CONSTRAINT "trip_proofs_captured_by_user_id_users_id_fk" FOREIGN KEY ("captured_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_proofs" ADD CONSTRAINT "trip_proofs_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_proofs" ADD CONSTRAINT "trip_proofs_stop_fk" FOREIGN KEY ("tenant_id","trip_id","trip_stop_id") REFERENCES "public"."trip_stops"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_proofs" ADD CONSTRAINT "trip_proofs_document_fk" FOREIGN KEY ("tenant_id","trip_id","trip_document_id") REFERENCES "public"."trip_documents"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_tolls" ADD CONSTRAINT "trip_tolls_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_tolls" ADD CONSTRAINT "trip_tolls_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_tolls" ADD CONSTRAINT "trip_tolls_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_tolls" ADD CONSTRAINT "trip_tolls_stop_fk" FOREIGN KEY ("tenant_id","trip_id","trip_stop_id") REFERENCES "public"."trip_stops"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_tolls" ADD CONSTRAINT "trip_tolls_document_fk" FOREIGN KEY ("tenant_id","trip_id","trip_document_id") REFERENCES "public"."trip_documents"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_checkins_tenant_trip_stop_time_idx" ON "trip_checkins" USING btree ("tenant_id","trip_id","trip_stop_id","occurred_at");--> statement-breakpoint
CREATE INDEX "trip_checklists_tenant_trip_status_idx" ON "trip_checklists" USING btree ("tenant_id","trip_id","status");--> statement-breakpoint
CREATE INDEX "trip_checklists_tenant_trip_stop_idx" ON "trip_checklists" USING btree ("tenant_id","trip_id","trip_stop_id");--> statement-breakpoint
CREATE INDEX "trip_delivery_proofs_tenant_trip_delivered_idx" ON "trip_delivery_proofs" USING btree ("tenant_id","trip_id","delivered_at");--> statement-breakpoint
CREATE INDEX "trip_documents_tenant_trip_relation_idx" ON "trip_documents" USING btree ("tenant_id","trip_id","relation_type","created_at");--> statement-breakpoint
CREATE INDEX "trip_events_tenant_trip_occurred_idx" ON "trip_events" USING btree ("tenant_id","trip_id","occurred_at");--> statement-breakpoint
CREATE INDEX "trip_events_tenant_trip_type_idx" ON "trip_events" USING btree ("tenant_id","trip_id","event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "trip_expenses_tenant_trip_time_idx" ON "trip_expenses" USING btree ("tenant_id","trip_id","incurred_at");--> statement-breakpoint
CREATE INDEX "trip_expenses_tenant_trip_status_idx" ON "trip_expenses" USING btree ("tenant_id","trip_id","status");--> statement-breakpoint
CREATE INDEX "trip_fuel_tenant_trip_time_idx" ON "trip_fuel" USING btree ("tenant_id","trip_id","fueled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_locations_provider_event_unique" ON "trip_locations" USING btree ("tenant_id","provider","provider_event_id") WHERE "trip_locations"."provider" IS NOT NULL AND "trip_locations"."provider_event_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "trip_locations_tenant_trip_recorded_idx" ON "trip_locations" USING btree ("tenant_id","trip_id","recorded_at");--> statement-breakpoint
CREATE INDEX "trip_proofs_tenant_trip_type_time_idx" ON "trip_proofs" USING btree ("tenant_id","trip_id","proof_type","captured_at");--> statement-breakpoint
CREATE INDEX "trip_tolls_tenant_trip_time_idx" ON "trip_tolls" USING btree ("tenant_id","trip_id","occurred_at");--> statement-breakpoint
CREATE POLICY "trip_checkins_tenant_isolation" ON "trip_checkins" AS PERMISSIVE FOR ALL TO public USING ("trip_checkins"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_checkins"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_checklists_tenant_isolation" ON "trip_checklists" AS PERMISSIVE FOR ALL TO public USING ("trip_checklists"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_checklists"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_delivery_proofs_tenant_isolation" ON "trip_delivery_proofs" AS PERMISSIVE FOR ALL TO public USING ("trip_delivery_proofs"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_delivery_proofs"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_documents_tenant_isolation" ON "trip_documents" AS PERMISSIVE FOR ALL TO public USING ("trip_documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_events_tenant_isolation" ON "trip_events" AS PERMISSIVE FOR ALL TO public USING ("trip_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_expenses_tenant_isolation" ON "trip_expenses" AS PERMISSIVE FOR ALL TO public USING ("trip_expenses"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_expenses"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_fuel_tenant_isolation" ON "trip_fuel" AS PERMISSIVE FOR ALL TO public USING ("trip_fuel"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_fuel"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_locations_tenant_isolation" ON "trip_locations" AS PERMISSIVE FOR ALL TO public USING ("trip_locations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_locations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_proofs_tenant_isolation" ON "trip_proofs" AS PERMISSIVE FOR ALL TO public USING ("trip_proofs"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_proofs"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_tolls_tenant_isolation" ON "trip_tolls" AS PERMISSIVE FOR ALL TO public USING ("trip_tolls"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_tolls"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);