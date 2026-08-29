CREATE TABLE "business_party_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"label" varchar(160) NOT NULL,
	"postal_code" varchar(16),
	"street" varchar(200) NOT NULL,
	"number" varchar(40),
	"complement" varchar(160),
	"district" varchar(120),
	"city" varchar(120) NOT NULL,
	"state" varchar(2) NOT NULL,
	"country_code" varchar(2) DEFAULT 'BR' NOT NULL,
	"operational_reference" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_party_addresses_tenant_party_id_unique" UNIQUE("tenant_id","party_id","id"),
	CONSTRAINT "business_party_addresses_type_check" CHECK ("business_party_addresses"."type" in ('billing', 'pickup', 'delivery', 'operational', 'other')),
	CONSTRAINT "business_party_addresses_state_check" CHECK ("business_party_addresses"."state" ~ '^[A-Z]{2}$'),
	CONSTRAINT "business_party_addresses_country_check" CHECK ("business_party_addresses"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "business_party_addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "business_party_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"address_id" uuid,
	"type" varchar(32) NOT NULL,
	"name" varchar(160) NOT NULL,
	"title" varchar(120),
	"email" varchar(254),
	"phone" varchar(32),
	"whatsapp" varchar(32),
	"operational_reference" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_party_contacts_tenant_party_id_unique" UNIQUE("tenant_id","party_id","id"),
	CONSTRAINT "business_party_contacts_type_check" CHECK ("business_party_contacts"."type" in ('commercial', 'logistics', 'billing', 'pickup', 'delivery', 'operational', 'other')),
	CONSTRAINT "business_party_contacts_channel_check" CHECK ("business_party_contacts"."email" is not null OR "business_party_contacts"."phone" is not null OR "business_party_contacts"."whatsapp" is not null)
);
--> statement-breakpoint
ALTER TABLE "business_party_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business_party_addresses" ADD CONSTRAINT "business_party_addresses_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_contacts" ADD CONSTRAINT "business_party_contacts_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_contacts" ADD CONSTRAINT "business_party_contacts_address_fk" FOREIGN KEY ("tenant_id","party_id","address_id") REFERENCES "public"."business_party_addresses"("tenant_id","party_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_party_addresses_tenant_party_active_idx" ON "business_party_addresses" USING btree ("tenant_id","party_id","is_active");--> statement-breakpoint
CREATE INDEX "business_party_addresses_tenant_city_state_idx" ON "business_party_addresses" USING btree ("tenant_id","city","state");--> statement-breakpoint
CREATE INDEX "business_party_contacts_tenant_party_active_idx" ON "business_party_contacts" USING btree ("tenant_id","party_id","is_active");--> statement-breakpoint
CREATE INDEX "business_party_contacts_tenant_address_idx" ON "business_party_contacts" USING btree ("tenant_id","address_id");--> statement-breakpoint
CREATE POLICY "business_party_addresses_tenant_isolation" ON "business_party_addresses" AS PERMISSIVE FOR ALL TO public USING ("business_party_addresses"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_addresses"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "business_party_contacts_tenant_isolation" ON "business_party_contacts" AS PERMISSIVE FOR ALL TO public USING ("business_party_contacts"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_contacts"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE business_party_addresses TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE business_party_contacts TO nexora_app;
