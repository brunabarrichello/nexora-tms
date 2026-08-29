CREATE TYPE "public"."commercial_terms_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "transport_request_commercial_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"commercial_terms_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"status" "commercial_terms_status" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"note" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_request_commercial_history_terms_version_unique" UNIQUE("tenant_id","commercial_terms_id","version"),
	CONSTRAINT "transport_request_commercial_history_version_check" CHECK ("transport_request_commercial_history"."version" > 0),
	CONSTRAINT "transport_request_commercial_history_event_check" CHECK ("transport_request_commercial_history"."event_type" in ('created','updated','submitted','approved','rejected'))
);
--> statement-breakpoint
ALTER TABLE "transport_request_commercial_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_request_commercial_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"currency_code" varchar(3) DEFAULT 'BRL' NOT NULL,
	"customer_price" numeric(14, 2),
	"target_carrier_freight" numeric(14, 2) NOT NULL,
	"toll_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"additional_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_terms" varchar(300) NOT NULL,
	"commercial_notes" varchar(1000),
	"status" "commercial_terms_status" DEFAULT 'draft' NOT NULL,
	"approval_note" varchar(1000),
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_request_commercial_terms_tenant_request_unique" UNIQUE("tenant_id","transport_request_id"),
	CONSTRAINT "transport_request_commercial_terms_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "transport_request_commercial_terms_currency_check" CHECK ("transport_request_commercial_terms"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "transport_request_commercial_terms_customer_price_check" CHECK ("transport_request_commercial_terms"."customer_price" is null OR "transport_request_commercial_terms"."customer_price" >= 0),
	CONSTRAINT "transport_request_commercial_terms_carrier_freight_check" CHECK ("transport_request_commercial_terms"."target_carrier_freight" > 0),
	CONSTRAINT "transport_request_commercial_terms_toll_check" CHECK ("transport_request_commercial_terms"."toll_amount" >= 0),
	CONSTRAINT "transport_request_commercial_terms_additional_check" CHECK ("transport_request_commercial_terms"."additional_amount" >= 0),
	CONSTRAINT "transport_request_commercial_terms_payment_check" CHECK (length(trim("transport_request_commercial_terms"."payment_terms")) > 0),
	CONSTRAINT "transport_request_commercial_terms_version_check" CHECK ("transport_request_commercial_terms"."version" > 0),
	CONSTRAINT "transport_request_commercial_terms_approval_check" CHECK ("transport_request_commercial_terms"."status" <> 'approved' OR ("transport_request_commercial_terms"."approved_by_user_id" is not null AND "transport_request_commercial_terms"."approved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "transport_request_commercial_terms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transport_request_commercial_history" ADD CONSTRAINT "transport_request_commercial_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_commercial_history" ADD CONSTRAINT "transport_request_commercial_history_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_commercial_history" ADD CONSTRAINT "transport_request_commercial_history_terms_fk" FOREIGN KEY ("tenant_id","commercial_terms_id") REFERENCES "public"."transport_request_commercial_terms"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_commercial_terms" ADD CONSTRAINT "transport_request_commercial_terms_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_commercial_terms" ADD CONSTRAINT "transport_request_commercial_terms_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_commercial_terms" ADD CONSTRAINT "transport_request_commercial_terms_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_commercial_terms" ADD CONSTRAINT "transport_request_commercial_terms_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transport_request_commercial_history_request_idx" ON "transport_request_commercial_history" USING btree ("tenant_id","transport_request_id","version");--> statement-breakpoint
CREATE INDEX "transport_request_commercial_terms_tenant_status_idx" ON "transport_request_commercial_terms" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE POLICY "transport_request_commercial_history_tenant_isolation" ON "transport_request_commercial_history" AS PERMISSIVE FOR ALL TO public USING ("transport_request_commercial_history"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_request_commercial_history"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "transport_request_commercial_terms_tenant_isolation" ON "transport_request_commercial_terms" AS PERMISSIVE FOR ALL TO public USING ("transport_request_commercial_terms"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_request_commercial_terms"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE transport_request_commercial_terms TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE transport_request_commercial_history TO nexora_app;
