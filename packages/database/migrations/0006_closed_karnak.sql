CREATE TYPE "public"."transport_stop_type" AS ENUM('pickup', 'delivery', 'support');--> statement-breakpoint
CREATE TABLE "transport_request_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"type" "transport_stop_type" NOT NULL,
	"party_id" uuid NOT NULL,
	"address_id" uuid NOT NULL,
	"contact_id" uuid,
	"window_start_at" timestamp with time zone NOT NULL,
	"window_end_at" timestamp with time zone NOT NULL,
	"instructions" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_request_stops_tenant_request_id_unique" UNIQUE("tenant_id","transport_request_id","id"),
	CONSTRAINT "transport_request_stops_tenant_request_sequence_unique" UNIQUE("tenant_id","transport_request_id","sequence"),
	CONSTRAINT "transport_request_stops_sequence_check" CHECK ("transport_request_stops"."sequence" > 0),
	CONSTRAINT "transport_request_stops_window_check" CHECK ("transport_request_stops"."window_end_at" >= "transport_request_stops"."window_start_at")
);
--> statement-breakpoint
ALTER TABLE "transport_request_stops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transport_request_stops" ADD CONSTRAINT "transport_request_stops_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_stops" ADD CONSTRAINT "transport_request_stops_address_fk" FOREIGN KEY ("tenant_id","party_id","address_id") REFERENCES "public"."business_party_addresses"("tenant_id","party_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_stops" ADD CONSTRAINT "transport_request_stops_contact_fk" FOREIGN KEY ("tenant_id","party_id","contact_id") REFERENCES "public"."business_party_contacts"("tenant_id","party_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transport_request_stops_tenant_request_sequence_idx" ON "transport_request_stops" USING btree ("tenant_id","transport_request_id","sequence");--> statement-breakpoint
CREATE INDEX "transport_request_stops_tenant_window_idx" ON "transport_request_stops" USING btree ("tenant_id","window_start_at");--> statement-breakpoint
CREATE POLICY "transport_request_stops_tenant_isolation" ON "transport_request_stops" AS PERMISSIVE FOR ALL TO public USING ("transport_request_stops"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_request_stops"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE transport_request_stops TO nexora_app;
