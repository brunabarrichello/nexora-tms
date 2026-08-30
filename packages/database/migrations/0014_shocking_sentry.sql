CREATE TYPE "public"."transport_contract_event_type" AS ENUM('confirmed', 'refused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transport_contract_status" AS ENUM('confirmed', 'refused', 'cancelled');--> statement-breakpoint
CREATE TABLE "transport_contract_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"type" "transport_contract_event_type" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_contract_events_type_unique" UNIQUE("tenant_id","contract_id","type"),
	CONSTRAINT "transport_contract_events_reason_check" CHECK ("transport_contract_events"."type" = 'confirmed' OR length(trim(coalesce("transport_contract_events"."reason", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "transport_contract_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"capacity_assignment_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"carrier_party_id" uuid NOT NULL,
	"status" "transport_contract_status" NOT NULL,
	"currency_code" varchar(3) NOT NULL,
	"freight_amount" numeric(14, 2) NOT NULL,
	"toll_amount" numeric(14, 2) NOT NULL,
	"additional_amount" numeric(14, 2) NOT NULL,
	"payment_terms" varchar(300) NOT NULL,
	"commercial_notes" varchar(1000),
	"confirmed_by_user_id" uuid,
	"confirmed_at" timestamp with time zone,
	"refused_by_user_id" uuid,
	"refused_at" timestamp with time zone,
	"refusal_reason" varchar(1000),
	"cancelled_by_user_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_contracts_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "transport_contracts_reservation_unique" UNIQUE("tenant_id","reservation_id"),
	CONSTRAINT "transport_contracts_currency_check" CHECK ("transport_contracts"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "transport_contracts_freight_amount_check" CHECK ("transport_contracts"."freight_amount" > 0),
	CONSTRAINT "transport_contracts_toll_amount_check" CHECK ("transport_contracts"."toll_amount" >= 0),
	CONSTRAINT "transport_contracts_additional_amount_check" CHECK ("transport_contracts"."additional_amount" >= 0),
	CONSTRAINT "transport_contracts_payment_terms_check" CHECK (length(trim("transport_contracts"."payment_terms")) > 0),
	CONSTRAINT "transport_contracts_state_check" CHECK ((
        "transport_contracts"."status" = 'confirmed'
        AND "transport_contracts"."confirmed_by_user_id" IS NOT NULL
        AND "transport_contracts"."confirmed_at" IS NOT NULL
        AND "transport_contracts"."refused_by_user_id" IS NULL
        AND "transport_contracts"."refused_at" IS NULL
        AND "transport_contracts"."refusal_reason" IS NULL
        AND "transport_contracts"."cancelled_by_user_id" IS NULL
        AND "transport_contracts"."cancelled_at" IS NULL
        AND "transport_contracts"."cancel_reason" IS NULL
      ) OR (
        "transport_contracts"."status" = 'refused'
        AND "transport_contracts"."confirmed_by_user_id" IS NULL
        AND "transport_contracts"."confirmed_at" IS NULL
        AND "transport_contracts"."refused_by_user_id" IS NOT NULL
        AND "transport_contracts"."refused_at" IS NOT NULL
        AND length(trim(coalesce("transport_contracts"."refusal_reason", ''))) > 0
        AND "transport_contracts"."cancelled_by_user_id" IS NULL
        AND "transport_contracts"."cancelled_at" IS NULL
        AND "transport_contracts"."cancel_reason" IS NULL
      ) OR (
        "transport_contracts"."status" = 'cancelled'
        AND "transport_contracts"."confirmed_by_user_id" IS NOT NULL
        AND "transport_contracts"."confirmed_at" IS NOT NULL
        AND "transport_contracts"."refused_by_user_id" IS NULL
        AND "transport_contracts"."refused_at" IS NULL
        AND "transport_contracts"."refusal_reason" IS NULL
        AND "transport_contracts"."cancelled_by_user_id" IS NOT NULL
        AND "transport_contracts"."cancelled_at" IS NOT NULL
        AND length(trim(coalesce("transport_contracts"."cancel_reason", ''))) > 0
      ))
);
--> statement-breakpoint
ALTER TABLE "transport_contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transport_contract_events" ADD CONSTRAINT "transport_contract_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_contract_events" ADD CONSTRAINT "transport_contract_events_contract_fk" FOREIGN KEY ("tenant_id","contract_id") REFERENCES "public"."transport_contracts"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_refused_by_user_id_users_id_fk" FOREIGN KEY ("refused_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_reservation_fk" FOREIGN KEY ("tenant_id","reservation_id") REFERENCES "public"."capacity_reservations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_proposal_fk" FOREIGN KEY ("tenant_id","proposal_id") REFERENCES "public"."freight_proposals"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_assignment_fk" FOREIGN KEY ("tenant_id","capacity_assignment_id") REFERENCES "public"."capacity_assignments"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_vehicle_fk" FOREIGN KEY ("tenant_id","vehicle_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_carrier_party_fk" FOREIGN KEY ("tenant_id","carrier_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transport_contract_events_contract_created_idx" ON "transport_contract_events" USING btree ("tenant_id","contract_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transport_contracts_confirmed_request_unique" ON "transport_contracts" USING btree ("tenant_id","transport_request_id") WHERE "transport_contracts"."status" = 'confirmed';--> statement-breakpoint
CREATE UNIQUE INDEX "transport_contracts_confirmed_assignment_unique" ON "transport_contracts" USING btree ("tenant_id","capacity_assignment_id") WHERE "transport_contracts"."status" = 'confirmed';--> statement-breakpoint
CREATE UNIQUE INDEX "transport_contracts_confirmed_driver_unique" ON "transport_contracts" USING btree ("tenant_id","driver_id") WHERE "transport_contracts"."status" = 'confirmed';--> statement-breakpoint
CREATE UNIQUE INDEX "transport_contracts_confirmed_vehicle_unique" ON "transport_contracts" USING btree ("tenant_id","vehicle_id") WHERE "transport_contracts"."status" = 'confirmed';--> statement-breakpoint
CREATE INDEX "transport_contracts_request_history_idx" ON "transport_contracts" USING btree ("tenant_id","transport_request_id","created_at");--> statement-breakpoint
CREATE INDEX "transport_contracts_carrier_status_idx" ON "transport_contracts" USING btree ("tenant_id","carrier_party_id","status");--> statement-breakpoint
CREATE POLICY "transport_contract_events_tenant_isolation" ON "transport_contract_events" AS PERMISSIVE FOR ALL TO public USING ("transport_contract_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_contract_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "transport_contracts_tenant_isolation" ON "transport_contracts" AS PERMISSIVE FOR ALL TO public USING ("transport_contracts"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_contracts"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE transport_contracts TO nexora_app;
--> statement-breakpoint
GRANT UPDATE (status, cancelled_by_user_id, cancelled_at, cancel_reason, updated_at) ON TABLE transport_contracts TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE transport_contract_events TO nexora_app;
