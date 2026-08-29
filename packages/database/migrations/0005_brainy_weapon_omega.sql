CREATE TYPE "public"."transport_request_status" AS ENUM('draft', 'ready_for_quote', 'in_negotiation', 'contracted', 'cancelled');--> statement-breakpoint
CREATE TABLE "transport_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_party_id" uuid NOT NULL,
	"shipper_party_id" uuid NOT NULL,
	"consignee_party_id" uuid NOT NULL,
	"origin_address_id" uuid NOT NULL,
	"destination_address_id" uuid NOT NULL,
	"planned_pickup_at" timestamp with time zone NOT NULL,
	"planned_delivery_at" timestamp with time zone NOT NULL,
	"cargo_description" varchar(1000) NOT NULL,
	"status" "transport_request_status" DEFAULT 'draft' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_requests_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "transport_requests_planned_window_check" CHECK ("transport_requests"."planned_delivery_at" >= "transport_requests"."planned_pickup_at"),
	CONSTRAINT "transport_requests_distinct_addresses_check" CHECK ("transport_requests"."origin_address_id" <> "transport_requests"."destination_address_id")
);
--> statement-breakpoint
ALTER TABLE "transport_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_customer_fk" FOREIGN KEY ("tenant_id","customer_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_shipper_fk" FOREIGN KEY ("tenant_id","shipper_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_consignee_fk" FOREIGN KEY ("tenant_id","consignee_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_origin_fk" FOREIGN KEY ("tenant_id","shipper_party_id","origin_address_id") REFERENCES "public"."business_party_addresses"("tenant_id","party_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_destination_fk" FOREIGN KEY ("tenant_id","consignee_party_id","destination_address_id") REFERENCES "public"."business_party_addresses"("tenant_id","party_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transport_requests_tenant_status_idx" ON "transport_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "transport_requests_tenant_pickup_idx" ON "transport_requests" USING btree ("tenant_id","planned_pickup_at");--> statement-breakpoint
CREATE INDEX "transport_requests_tenant_customer_idx" ON "transport_requests" USING btree ("tenant_id","customer_party_id");--> statement-breakpoint
CREATE POLICY "transport_requests_tenant_isolation" ON "transport_requests" AS PERMISSIVE FOR ALL TO public USING ("transport_requests"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_requests"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE transport_requests TO nexora_app;
