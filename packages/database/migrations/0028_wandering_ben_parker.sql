CREATE TABLE "trip_occurrence_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"relation_type" varchar(24) DEFAULT 'evidence' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_occurrence_documents_unique" UNIQUE("tenant_id","occurrence_id","document_id","relation_type"),
	CONSTRAINT "trip_occurrence_documents_relation_check" CHECK ("trip_occurrence_documents"."relation_type" in ('evidence','attachment','other'))
);
--> statement-breakpoint
ALTER TABLE "trip_occurrence_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_occurrence_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"from_status" varchar(16),
	"to_status" varchar(16),
	"responsible_user_id" uuid,
	"note" varchar(2000),
	"actor_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_occurrence_history_action_check" CHECK ("trip_occurrence_history"."action" in ('created','treatment','status_changed')),
	CONSTRAINT "trip_occurrence_history_from_status_check" CHECK ("trip_occurrence_history"."from_status" IS NULL OR "trip_occurrence_history"."from_status" in ('open','resolved')),
	CONSTRAINT "trip_occurrence_history_to_status_check" CHECK ("trip_occurrence_history"."to_status" IS NULL OR "trip_occurrence_history"."to_status" in ('open','resolved')),
	CONSTRAINT "trip_occurrence_history_payload_check" CHECK (("trip_occurrence_history"."action" = 'created' AND "trip_occurrence_history"."from_status" IS NULL AND "trip_occurrence_history"."to_status" = 'open') OR ("trip_occurrence_history"."action" = 'status_changed' AND "trip_occurrence_history"."from_status" IS NOT NULL AND "trip_occurrence_history"."to_status" IS NOT NULL AND "trip_occurrence_history"."from_status" <> "trip_occurrence_history"."to_status") OR ("trip_occurrence_history"."action" = 'treatment' AND length(trim(coalesce("trip_occurrence_history"."note", ''))) > 0))
);
--> statement-breakpoint
ALTER TABLE "trip_occurrence_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_stop_id" uuid,
	"occurrence_type" varchar(40) NOT NULL,
	"severity" varchar(16) DEFAULT 'medium' NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"location_text" varchar(500),
	"description" varchar(2000) NOT NULL,
	"responsible_user_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_occurrences_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "trip_occurrences_tenant_trip_id_unique" UNIQUE("tenant_id","trip_id","id"),
	CONSTRAINT "trip_occurrences_type_check" CHECK ("trip_occurrences"."occurrence_type" in ('delay','damage','contact_loss','accident','breakdown','route_deviation','cargo_issue','security','documentation','other')),
	CONSTRAINT "trip_occurrences_severity_check" CHECK ("trip_occurrences"."severity" in ('low','medium','high','critical')),
	CONSTRAINT "trip_occurrences_status_check" CHECK ("trip_occurrences"."status" in ('open','resolved')),
	CONSTRAINT "trip_occurrences_description_check" CHECK (length(trim("trip_occurrences"."description")) > 0),
	CONSTRAINT "trip_occurrences_coordinates_pair_check" CHECK (("trip_occurrences"."latitude" IS NULL AND "trip_occurrences"."longitude" IS NULL) OR ("trip_occurrences"."latitude" IS NOT NULL AND "trip_occurrences"."longitude" IS NOT NULL)),
	CONSTRAINT "trip_occurrences_latitude_check" CHECK ("trip_occurrences"."latitude" IS NULL OR ("trip_occurrences"."latitude" >= -90 AND "trip_occurrences"."latitude" <= 90)),
	CONSTRAINT "trip_occurrences_longitude_check" CHECK ("trip_occurrences"."longitude" IS NULL OR ("trip_occurrences"."longitude" >= -180 AND "trip_occurrences"."longitude" <= 180)),
	CONSTRAINT "trip_occurrences_resolution_check" CHECK (("trip_occurrences"."status" = 'open' AND "trip_occurrences"."resolved_at" IS NULL AND "trip_occurrences"."resolved_by_user_id" IS NULL) OR ("trip_occurrences"."status" = 'resolved' AND "trip_occurrences"."resolved_at" IS NOT NULL AND "trip_occurrences"."resolved_by_user_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "trip_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trip_occurrence_documents" ADD CONSTRAINT "trip_occurrence_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_occurrence_documents" ADD CONSTRAINT "trip_occurrence_documents_occurrence_fk" FOREIGN KEY ("tenant_id","occurrence_id") REFERENCES "public"."trip_occurrences"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_occurrence_documents" ADD CONSTRAINT "trip_occurrence_documents_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_occurrence_history" ADD CONSTRAINT "trip_occurrence_history_responsible_user_id_users_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_occurrence_history" ADD CONSTRAINT "trip_occurrence_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_occurrence_history" ADD CONSTRAINT "trip_occurrence_history_occurrence_fk" FOREIGN KEY ("tenant_id","occurrence_id") REFERENCES "public"."trip_occurrences"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_occurrences" ADD CONSTRAINT "trip_occurrences_responsible_user_id_users_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_occurrences" ADD CONSTRAINT "trip_occurrences_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_occurrences" ADD CONSTRAINT "trip_occurrences_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_occurrences" ADD CONSTRAINT "trip_occurrences_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_occurrences" ADD CONSTRAINT "trip_occurrences_stop_fk" FOREIGN KEY ("tenant_id","trip_id","trip_stop_id") REFERENCES "public"."trip_stops"("tenant_id","trip_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_occurrence_documents_tenant_occurrence_idx" ON "trip_occurrence_documents" USING btree ("tenant_id","occurrence_id","created_at");--> statement-breakpoint
CREATE INDEX "trip_occurrence_history_tenant_occurrence_time_idx" ON "trip_occurrence_history" USING btree ("tenant_id","occurrence_id","created_at");--> statement-breakpoint
CREATE INDEX "trip_occurrences_tenant_trip_status_time_idx" ON "trip_occurrences" USING btree ("tenant_id","trip_id","status","occurred_at");--> statement-breakpoint
CREATE INDEX "trip_occurrences_tenant_responsible_status_idx" ON "trip_occurrences" USING btree ("tenant_id","responsible_user_id","status");--> statement-breakpoint
CREATE POLICY "trip_occurrence_documents_tenant_isolation" ON "trip_occurrence_documents" AS PERMISSIVE FOR ALL TO public USING ("trip_occurrence_documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_occurrence_documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_occurrence_history_tenant_isolation" ON "trip_occurrence_history" AS PERMISSIVE FOR ALL TO public USING ("trip_occurrence_history"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_occurrence_history"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "trip_occurrences_tenant_isolation" ON "trip_occurrences" AS PERMISSIVE FOR ALL TO public USING ("trip_occurrences"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("trip_occurrences"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE trip_occurrences TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE trip_occurrence_history, trip_occurrence_documents TO nexora_app;
