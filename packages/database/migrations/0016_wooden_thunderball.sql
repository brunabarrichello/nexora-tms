CREATE TABLE "currencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(3) NOT NULL,
	"numeric_code" varchar(3),
	"name" varchar(120) NOT NULL,
	"symbol" varchar(8),
	"minor_unit" smallint DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "currencies_code_unique" UNIQUE("code"),
	CONSTRAINT "currencies_numeric_code_unique" UNIQUE("numeric_code"),
	CONSTRAINT "currencies_code_check" CHECK ("currencies"."code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "currencies_numeric_code_check" CHECK ("currencies"."numeric_code" IS NULL OR "currencies"."numeric_code" ~ '^[0-9]{3}$'),
	CONSTRAINT "currencies_name_check" CHECK (length(trim("currencies"."name")) >= 2),
	CONSTRAINT "currencies_minor_unit_check" CHECK ("currencies"."minor_unit" >= 0 AND "currencies"."minor_unit" <= 6)
);
--> statement-breakpoint
CREATE TABLE "business_party_billing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"party_id" uuid NOT NULL,
	"rule_type" varchar(64) NOT NULL,
	"configuration" jsonb NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "business_party_billing_rules_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "business_party_billing_rules_type_check" CHECK (length(trim("business_party_billing_rules"."rule_type")) > 0),
	CONSTRAINT "business_party_billing_rules_period_check" CHECK ("business_party_billing_rules"."valid_until" IS NULL OR "business_party_billing_rules"."valid_until" >= "business_party_billing_rules"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "business_party_billing_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "business_party_credit_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"party_id" uuid NOT NULL,
	"currency_id" uuid NOT NULL,
	"limit_amount" numeric(18, 2) NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "business_party_credit_limits_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "business_party_credit_limits_amount_check" CHECK ("business_party_credit_limits"."limit_amount" >= 0),
	CONSTRAINT "business_party_credit_limits_period_check" CHECK ("business_party_credit_limits"."valid_until" IS NULL OR "business_party_credit_limits"."valid_until" >= "business_party_credit_limits"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "business_party_credit_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "business_party_document_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"party_id" uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"subject_scope" varchar(32) NOT NULL,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"lead_days" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "business_party_document_requirements_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "business_party_document_requirements_unique" UNIQUE("tenant_id","party_id","document_type_id","subject_scope"),
	CONSTRAINT "business_party_document_requirements_scope_check" CHECK (length(trim("business_party_document_requirements"."subject_scope")) > 0),
	CONSTRAINT "business_party_document_requirements_lead_days_check" CHECK ("business_party_document_requirements"."lead_days" >= 0)
);
--> statement-breakpoint
ALTER TABLE "business_party_document_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "business_party_group_members" (
	"tenant_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_party_group_members_pk" PRIMARY KEY("tenant_id","group_id","party_id"),
	CONSTRAINT "business_party_group_members_period_check" CHECK ("business_party_group_members"."ends_on" IS NULL OR "business_party_group_members"."starts_on" IS NULL OR "business_party_group_members"."ends_on" >= "business_party_group_members"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "business_party_group_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "business_party_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"group_type" varchar(32) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "business_party_groups_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "business_party_groups_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "business_party_groups_type_check" CHECK ("business_party_groups"."group_type" in ('economic','commercial','operational','risk','other'))
);
--> statement-breakpoint
ALTER TABLE "business_party_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "business_party_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"party_id" uuid NOT NULL,
	"requirement_type" varchar(64) NOT NULL,
	"value_text" varchar(1000),
	"value_json" jsonb,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"valid_from" date,
	"valid_until" date,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "business_party_requirements_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "business_party_requirements_type_check" CHECK (length(trim("business_party_requirements"."requirement_type")) > 0),
	CONSTRAINT "business_party_requirements_value_check" CHECK (num_nonnulls("business_party_requirements"."value_text", "business_party_requirements"."value_json") <= 1 AND (NOT "business_party_requirements"."is_mandatory" OR num_nonnulls("business_party_requirements"."value_text", "business_party_requirements"."value_json") = 1)),
	CONSTRAINT "business_party_requirements_period_check" CHECK ("business_party_requirements"."valid_until" IS NULL OR "business_party_requirements"."valid_from" IS NULL OR "business_party_requirements"."valid_until" >= "business_party_requirements"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "business_party_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "business_party_service_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"party_id" uuid NOT NULL,
	"state_id" uuid,
	"city_id" uuid,
	"radius_km" numeric(10, 2),
	"direction" varchar(16) DEFAULT 'both' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "business_party_service_areas_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "business_party_service_areas_geo_check" CHECK (num_nonnulls("business_party_service_areas"."state_id", "business_party_service_areas"."city_id") = 1),
	CONSTRAINT "business_party_service_areas_radius_check" CHECK ("business_party_service_areas"."radius_km" IS NULL OR "business_party_service_areas"."radius_km" > 0),
	CONSTRAINT "business_party_service_areas_direction_check" CHECK ("business_party_service_areas"."direction" in ('inbound','outbound','both'))
);
--> statement-breakpoint
ALTER TABLE "business_party_service_areas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "business_party_tags" (
	"tenant_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_party_tags_pk" PRIMARY KEY("tenant_id","party_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "business_party_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_asset_tags" (
	"tenant_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capacity_asset_tags_pk" PRIMARY KEY("tenant_id","asset_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "commodities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" varchar(500),
	"default_cargo_type_id" uuid,
	"is_hazardous" boolean DEFAULT false NOT NULL,
	"requires_temperature_control" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "commodities_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "commodities_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "commodities_code_check" CHECK (length(trim("commodities"."code")) > 0),
	CONSTRAINT "commodities_name_check" CHECK (length(trim("commodities"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "commodities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_unit_id" uuid,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "cost_centers_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "cost_centers_tenant_org_code_unique" UNIQUE("tenant_id","organization_id","code"),
	CONSTRAINT "cost_centers_code_check" CHECK (length(trim("cost_centers"."code")) > 0),
	CONSTRAINT "cost_centers_name_check" CHECK (length(trim("cost_centers"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "cost_centers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"key" varchar(120) NOT NULL,
	"label" varchar(160) NOT NULL,
	"data_type" varchar(32) NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"validation" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "custom_field_definitions_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "custom_field_definitions_tenant_entity_key_unique" UNIQUE("tenant_id","entity_type","key"),
	CONSTRAINT "custom_field_definitions_entity_type_check" CHECK (length(trim("custom_field_definitions"."entity_type")) > 0),
	CONSTRAINT "custom_field_definitions_key_check" CHECK (length(trim("custom_field_definitions"."key")) > 0),
	CONSTRAINT "custom_field_definitions_label_check" CHECK (length(trim("custom_field_definitions"."label")) > 0),
	CONSTRAINT "custom_field_definitions_data_type_check" CHECK ("custom_field_definitions"."data_type" in ('string','number','boolean','date','datetime','json'))
);
--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "custom_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"definition_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"value_json" jsonb NOT NULL,
	CONSTRAINT "custom_field_values_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "custom_field_values_tenant_definition_subject_unique" UNIQUE("tenant_id","definition_id","subject_id")
);
--> statement-breakpoint
ALTER TABLE "custom_field_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_unit_id" uuid,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "departments_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "departments_tenant_org_code_unique" UNIQUE("tenant_id","organization_id","code"),
	CONSTRAINT "departments_code_check" CHECK (length(trim("departments"."code")) > 0),
	CONSTRAINT "departments_name_check" CHECK (length(trim("departments"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_tags" (
	"tenant_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_tags_pk" PRIMARY KEY("tenant_id","driver_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "driver_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key" varchar(120) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "feature_flags_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "feature_flags_tenant_key_unique" UNIQUE("tenant_id","key"),
	CONSTRAINT "feature_flags_key_check" CHECK (length(trim("feature_flags"."key")) > 0)
);
--> statement-breakpoint
ALTER TABLE "feature_flags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"party_id" uuid,
	"address_id" uuid,
	"code" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" varchar(32) NOT NULL,
	"city_id" uuid,
	"postal_code" varchar(16),
	"street" varchar(200),
	"number" varchar(40),
	"complement" varchar(160),
	"district" varchar(120),
	"latitude" numeric(9, 6),
	"longitude" numeric(10, 6),
	"operational_reference" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	CONSTRAINT "locations_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "locations_code_check" CHECK (length(trim("locations"."code")) > 0),
	CONSTRAINT "locations_name_check" CHECK (length(trim("locations"."name")) > 0),
	CONSTRAINT "locations_type_check" CHECK ("locations"."type" in ('customer','shipper','consignee','terminal','warehouse','yard','port','airport','border','support','other')),
	CONSTRAINT "locations_party_address_pair_check" CHECK (("locations"."party_id" IS NULL AND "locations"."address_id" IS NULL) OR ("locations"."party_id" IS NOT NULL AND "locations"."address_id" IS NOT NULL)),
	CONSTRAINT "locations_standalone_address_check" CHECK ("locations"."address_id" IS NOT NULL OR ("locations"."city_id" IS NOT NULL AND length(trim(coalesce("locations"."street", ''))) >= 2)),
	CONSTRAINT "locations_latitude_check" CHECK ("locations"."latitude" IS NULL OR ("locations"."latitude" >= -90 AND "locations"."latitude" <= 90)),
	CONSTRAINT "locations_longitude_check" CHECK ("locations"."longitude" IS NULL OR ("locations"."longitude" >= -180 AND "locations"."longitude" <= 180)),
	CONSTRAINT "locations_coordinates_pair_check" CHECK (("locations"."latitude" IS NULL AND "locations"."longitude" IS NULL) OR ("locations"."latitude" IS NOT NULL AND "locations"."longitude" IS NOT NULL)),
	CONSTRAINT "locations_soft_delete_check" CHECK (("locations"."deleted_at" IS NULL AND "locations"."deleted_by_user_id" IS NULL) OR ("locations"."deleted_at" IS NOT NULL AND "locations"."deleted_by_user_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "module_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"module" varchar(64) NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "module_settings_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "module_settings_tenant_module_unique" UNIQUE("tenant_id","module"),
	CONSTRAINT "module_settings_module_check" CHECK (length(trim("module_settings"."module")) > 0)
);
--> statement-breakpoint
ALTER TABLE "module_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "number_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scope" varchar(64) NOT NULL,
	"prefix" varchar(32),
	"next_value" bigint DEFAULT 1 NOT NULL,
	"padding" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "number_sequences_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "number_sequences_tenant_scope_unique" UNIQUE("tenant_id","scope"),
	CONSTRAINT "number_sequences_scope_check" CHECK (length(trim("number_sequences"."scope")) > 0),
	CONSTRAINT "number_sequences_next_value_check" CHECK ("number_sequences"."next_value" > 0),
	CONSTRAINT "number_sequences_padding_check" CHECK ("number_sequences"."padding" >= 0 AND "number_sequences"."padding" <= 20)
);
--> statement-breakpoint
ALTER TABLE "number_sequences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_request_tags" (
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_request_tags_pk" PRIMARY KEY("tenant_id","transport_request_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "transport_request_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business_party_billing_rules" ADD CONSTRAINT "business_party_billing_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_billing_rules" ADD CONSTRAINT "business_party_billing_rules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_billing_rules" ADD CONSTRAINT "business_party_billing_rules_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_billing_rules" ADD CONSTRAINT "business_party_billing_rules_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_credit_limits" ADD CONSTRAINT "business_party_credit_limits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_credit_limits" ADD CONSTRAINT "business_party_credit_limits_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_credit_limits" ADD CONSTRAINT "business_party_credit_limits_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_credit_limits" ADD CONSTRAINT "business_party_credit_limits_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_credit_limits" ADD CONSTRAINT "business_party_credit_limits_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_document_requirements" ADD CONSTRAINT "business_party_document_requirements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_document_requirements" ADD CONSTRAINT "business_party_document_requirements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_document_requirements" ADD CONSTRAINT "business_party_document_requirements_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_document_requirements" ADD CONSTRAINT "business_party_document_requirements_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_document_requirements" ADD CONSTRAINT "business_party_document_requirements_document_type_fk" FOREIGN KEY ("tenant_id","document_type_id") REFERENCES "public"."document_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_group_members" ADD CONSTRAINT "business_party_group_members_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_group_members" ADD CONSTRAINT "business_party_group_members_group_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."business_party_groups"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_group_members" ADD CONSTRAINT "business_party_group_members_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_groups" ADD CONSTRAINT "business_party_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_groups" ADD CONSTRAINT "business_party_groups_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_groups" ADD CONSTRAINT "business_party_groups_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_requirements" ADD CONSTRAINT "business_party_requirements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_requirements" ADD CONSTRAINT "business_party_requirements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_requirements" ADD CONSTRAINT "business_party_requirements_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_requirements" ADD CONSTRAINT "business_party_requirements_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_service_areas" ADD CONSTRAINT "business_party_service_areas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_service_areas" ADD CONSTRAINT "business_party_service_areas_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_service_areas" ADD CONSTRAINT "business_party_service_areas_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_service_areas" ADD CONSTRAINT "business_party_service_areas_state_id_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_service_areas" ADD CONSTRAINT "business_party_service_areas_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_service_areas" ADD CONSTRAINT "business_party_service_areas_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_tags" ADD CONSTRAINT "business_party_tags_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_tags" ADD CONSTRAINT "business_party_tags_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_tags" ADD CONSTRAINT "business_party_tags_tag_fk" FOREIGN KEY ("tenant_id","tag_id") REFERENCES "public"."tags"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_tags" ADD CONSTRAINT "capacity_asset_tags_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_tags" ADD CONSTRAINT "capacity_asset_tags_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_tags" ADD CONSTRAINT "capacity_asset_tags_tag_fk" FOREIGN KEY ("tenant_id","tag_id") REFERENCES "public"."tags"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodities" ADD CONSTRAINT "commodities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodities" ADD CONSTRAINT "commodities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodities" ADD CONSTRAINT "commodities_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodities" ADD CONSTRAINT "commodities_default_cargo_type_fk" FOREIGN KEY ("tenant_id","default_cargo_type_id") REFERENCES "public"."cargo_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_organization_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_business_unit_fk" FOREIGN KEY ("tenant_id","organization_id","business_unit_id") REFERENCES "public"."business_units"("tenant_id","organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_definition_fk" FOREIGN KEY ("tenant_id","definition_id") REFERENCES "public"."custom_field_definitions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."organizations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_business_unit_fk" FOREIGN KEY ("tenant_id","organization_id","business_unit_id") REFERENCES "public"."business_units"("tenant_id","organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_tags" ADD CONSTRAINT "driver_tags_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_tags" ADD CONSTRAINT "driver_tags_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_tags" ADD CONSTRAINT "driver_tags_tag_fk" FOREIGN KEY ("tenant_id","tag_id") REFERENCES "public"."tags"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_party_address_fk" FOREIGN KEY ("tenant_id","party_id","address_id") REFERENCES "public"."business_party_addresses"("tenant_id","party_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_settings" ADD CONSTRAINT "module_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_settings" ADD CONSTRAINT "module_settings_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_settings" ADD CONSTRAINT "module_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_tags" ADD CONSTRAINT "transport_request_tags_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_tags" ADD CONSTRAINT "transport_request_tags_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_tags" ADD CONSTRAINT "transport_request_tags_tag_fk" FOREIGN KEY ("tenant_id","tag_id") REFERENCES "public"."tags"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "currencies_active_name_idx" ON "currencies" USING btree ("is_active","name");--> statement-breakpoint
CREATE INDEX "business_party_billing_rules_tenant_party_type_idx" ON "business_party_billing_rules" USING btree ("tenant_id","party_id","rule_type","is_active");--> statement-breakpoint
CREATE INDEX "business_party_credit_limits_tenant_party_currency_idx" ON "business_party_credit_limits" USING btree ("tenant_id","party_id","currency_id","is_active");--> statement-breakpoint
CREATE INDEX "business_party_document_requirements_tenant_party_idx" ON "business_party_document_requirements" USING btree ("tenant_id","party_id","is_active");--> statement-breakpoint
CREATE INDEX "business_party_group_members_tenant_party_idx" ON "business_party_group_members" USING btree ("tenant_id","party_id");--> statement-breakpoint
CREATE INDEX "business_party_groups_tenant_type_active_idx" ON "business_party_groups" USING btree ("tenant_id","group_type","is_active");--> statement-breakpoint
CREATE INDEX "business_party_requirements_tenant_party_type_idx" ON "business_party_requirements" USING btree ("tenant_id","party_id","requirement_type","is_active");--> statement-breakpoint
CREATE INDEX "business_party_service_areas_tenant_party_idx" ON "business_party_service_areas" USING btree ("tenant_id","party_id","is_active");--> statement-breakpoint
CREATE INDEX "business_party_service_areas_geo_idx" ON "business_party_service_areas" USING btree ("tenant_id","state_id","city_id");--> statement-breakpoint
CREATE INDEX "business_party_tags_tenant_tag_idx" ON "business_party_tags" USING btree ("tenant_id","tag_id");--> statement-breakpoint
CREATE INDEX "capacity_asset_tags_tenant_tag_idx" ON "capacity_asset_tags" USING btree ("tenant_id","tag_id");--> statement-breakpoint
CREATE INDEX "commodities_tenant_active_name_idx" ON "commodities" USING btree ("tenant_id","is_active","name");--> statement-breakpoint
CREATE INDEX "cost_centers_tenant_unit_active_idx" ON "cost_centers" USING btree ("tenant_id","business_unit_id","is_active");--> statement-breakpoint
CREATE INDEX "custom_field_definitions_tenant_entity_active_idx" ON "custom_field_definitions" USING btree ("tenant_id","entity_type","is_active");--> statement-breakpoint
CREATE INDEX "custom_field_values_tenant_subject_idx" ON "custom_field_values" USING btree ("tenant_id","subject_id");--> statement-breakpoint
CREATE INDEX "departments_tenant_unit_active_idx" ON "departments" USING btree ("tenant_id","business_unit_id","is_active");--> statement-breakpoint
CREATE INDEX "driver_tags_tenant_tag_idx" ON "driver_tags" USING btree ("tenant_id","tag_id");--> statement-breakpoint
CREATE INDEX "feature_flags_tenant_enabled_idx" ON "feature_flags" USING btree ("tenant_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_tenant_code_live_unique" ON "locations" USING btree ("tenant_id","code") WHERE "locations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "locations_tenant_city_active_idx" ON "locations" USING btree ("tenant_id","city_id","is_active");--> statement-breakpoint
CREATE INDEX "locations_tenant_party_active_idx" ON "locations" USING btree ("tenant_id","party_id","is_active");--> statement-breakpoint
CREATE INDEX "transport_request_tags_tenant_tag_idx" ON "transport_request_tags" USING btree ("tenant_id","tag_id");--> statement-breakpoint
CREATE POLICY "business_party_billing_rules_tenant_isolation" ON "business_party_billing_rules" AS PERMISSIVE FOR ALL TO public USING ("business_party_billing_rules"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_billing_rules"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "business_party_credit_limits_tenant_isolation" ON "business_party_credit_limits" AS PERMISSIVE FOR ALL TO public USING ("business_party_credit_limits"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_credit_limits"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "business_party_document_requirements_tenant_isolation" ON "business_party_document_requirements" AS PERMISSIVE FOR ALL TO public USING ("business_party_document_requirements"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_document_requirements"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "business_party_group_members_tenant_isolation" ON "business_party_group_members" AS PERMISSIVE FOR ALL TO public USING ("business_party_group_members"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_group_members"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "business_party_groups_tenant_isolation" ON "business_party_groups" AS PERMISSIVE FOR ALL TO public USING ("business_party_groups"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_groups"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "business_party_requirements_tenant_isolation" ON "business_party_requirements" AS PERMISSIVE FOR ALL TO public USING ("business_party_requirements"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_requirements"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "business_party_service_areas_tenant_isolation" ON "business_party_service_areas" AS PERMISSIVE FOR ALL TO public USING ("business_party_service_areas"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_service_areas"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "business_party_tags_tenant_isolation" ON "business_party_tags" AS PERMISSIVE FOR ALL TO public USING ("business_party_tags"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_tags"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_asset_tags_tenant_isolation" ON "capacity_asset_tags" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_tags"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_tags"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "commodities_tenant_isolation" ON "commodities" AS PERMISSIVE FOR ALL TO public USING ("commodities"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("commodities"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "cost_centers_tenant_isolation" ON "cost_centers" AS PERMISSIVE FOR ALL TO public USING ("cost_centers"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("cost_centers"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "custom_field_definitions_tenant_isolation" ON "custom_field_definitions" AS PERMISSIVE FOR ALL TO public USING ("custom_field_definitions"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("custom_field_definitions"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "custom_field_values_tenant_isolation" ON "custom_field_values" AS PERMISSIVE FOR ALL TO public USING ("custom_field_values"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("custom_field_values"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "departments_tenant_isolation" ON "departments" AS PERMISSIVE FOR ALL TO public USING ("departments"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("departments"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "driver_tags_tenant_isolation" ON "driver_tags" AS PERMISSIVE FOR ALL TO public USING ("driver_tags"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("driver_tags"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "feature_flags_tenant_isolation" ON "feature_flags" AS PERMISSIVE FOR ALL TO public USING ("feature_flags"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("feature_flags"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "locations_tenant_isolation" ON "locations" AS PERMISSIVE FOR ALL TO public USING ("locations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("locations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "module_settings_tenant_isolation" ON "module_settings" AS PERMISSIVE FOR ALL TO public USING ("module_settings"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("module_settings"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "number_sequences_tenant_isolation" ON "number_sequences" AS PERMISSIVE FOR ALL TO public USING ("number_sequences"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("number_sequences"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "transport_request_tags_tenant_isolation" ON "transport_request_tags" AS PERMISSIVE FOR ALL TO public USING ("transport_request_tags"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_request_tags"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT ON TABLE currencies TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE departments, cost_centers, number_sequences, module_settings, feature_flags, locations, business_party_groups, business_party_group_members, business_party_requirements, business_party_document_requirements, business_party_service_areas, business_party_billing_rules, business_party_credit_limits, commodities, business_party_tags, driver_tags, capacity_asset_tags, transport_request_tags, custom_field_definitions, custom_field_values TO nexora_app;
