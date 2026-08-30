CREATE TYPE "public"."capacity_reservation_event_type" AS ENUM('approved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."capacity_reservation_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TABLE "capacity_reservation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"type" "capacity_reservation_event_type" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capacity_reservation_events_reason_check" CHECK ("capacity_reservation_events"."type" <> 'cancelled' OR length(trim(coalesce("capacity_reservation_events"."reason", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "capacity_reservation_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"capacity_assignment_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"carrier_party_id" uuid NOT NULL,
	"status" "capacity_reservation_status" DEFAULT 'active' NOT NULL,
	"approved_by_user_id" uuid NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_by_user_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capacity_reservations_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_reservations_state_check" CHECK ((
        "capacity_reservations"."status" = 'active'
        AND "capacity_reservations"."cancelled_by_user_id" IS NULL
        AND "capacity_reservations"."cancelled_at" IS NULL
        AND "capacity_reservations"."cancel_reason" IS NULL
      ) OR (
        "capacity_reservations"."status" = 'cancelled'
        AND "capacity_reservations"."cancelled_by_user_id" IS NOT NULL
        AND "capacity_reservations"."cancelled_at" IS NOT NULL
        AND length(trim(coalesce("capacity_reservations"."cancel_reason", ''))) > 0
      ))
);
--> statement-breakpoint
ALTER TABLE "capacity_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "capacity_reservation_events" ADD CONSTRAINT "capacity_reservation_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_reservation_events" ADD CONSTRAINT "capacity_reservation_events_reservation_fk" FOREIGN KEY ("tenant_id","reservation_id") REFERENCES "public"."capacity_reservations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD CONSTRAINT "capacity_reservations_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD CONSTRAINT "capacity_reservations_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD CONSTRAINT "capacity_reservations_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD CONSTRAINT "capacity_reservations_proposal_fk" FOREIGN KEY ("tenant_id","proposal_id") REFERENCES "public"."freight_proposals"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD CONSTRAINT "capacity_reservations_assignment_fk" FOREIGN KEY ("tenant_id","capacity_assignment_id") REFERENCES "public"."capacity_assignments"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD CONSTRAINT "capacity_reservations_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD CONSTRAINT "capacity_reservations_vehicle_fk" FOREIGN KEY ("tenant_id","vehicle_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD CONSTRAINT "capacity_reservations_carrier_party_fk" FOREIGN KEY ("tenant_id","carrier_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capacity_reservation_events_reservation_created_idx" ON "capacity_reservation_events" USING btree ("tenant_id","reservation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "capacity_reservations_active_request_unique" ON "capacity_reservations" USING btree ("tenant_id","transport_request_id") WHERE "capacity_reservations"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "capacity_reservations_active_assignment_unique" ON "capacity_reservations" USING btree ("tenant_id","capacity_assignment_id") WHERE "capacity_reservations"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "capacity_reservations_active_driver_unique" ON "capacity_reservations" USING btree ("tenant_id","driver_id") WHERE "capacity_reservations"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "capacity_reservations_active_vehicle_unique" ON "capacity_reservations" USING btree ("tenant_id","vehicle_id") WHERE "capacity_reservations"."status" = 'active';--> statement-breakpoint
CREATE INDEX "capacity_reservations_request_history_idx" ON "capacity_reservations" USING btree ("tenant_id","transport_request_id","created_at");--> statement-breakpoint
CREATE INDEX "capacity_reservations_carrier_status_idx" ON "capacity_reservations" USING btree ("tenant_id","carrier_party_id","status");--> statement-breakpoint
CREATE POLICY "capacity_reservation_events_tenant_isolation" ON "capacity_reservation_events" AS PERMISSIVE FOR ALL TO public USING ("capacity_reservation_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_reservation_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_reservations_tenant_isolation" ON "capacity_reservations" AS PERMISSIVE FOR ALL TO public USING ("capacity_reservations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_reservations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE capacity_reservations TO nexora_app;
--> statement-breakpoint
GRANT UPDATE (status, cancelled_by_user_id, cancelled_at, cancel_reason, updated_at) ON TABLE capacity_reservations TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE capacity_reservation_events TO nexora_app;
