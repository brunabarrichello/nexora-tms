CREATE TABLE "body_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" varchar(300),
	"is_closed" boolean DEFAULT false NOT NULL,
	"supports_side_loading" boolean DEFAULT false NOT NULL,
	"supports_rear_loading" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "body_types_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "body_types_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "body_types_code_check" CHECK (length(trim("body_types"."code")) > 0),
	CONSTRAINT "body_types_name_check" CHECK (length(trim("body_types"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "body_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cargo_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" varchar(300),
	"requires_special_handling" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cargo_types_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "cargo_types_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "cargo_types_code_check" CHECK (length(trim("cargo_types"."code")) > 0),
	CONSTRAINT "cargo_types_name_check" CHECK (length(trim("cargo_types"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "cargo_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_id" uuid NOT NULL,
	"ibge_code" varchar(10),
	"name" varchar(160) NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(10, 6),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cities_ibge_code_check" CHECK ("cities"."ibge_code" IS NULL OR "cities"."ibge_code" ~ '^[0-9]{1,10}$'),
	CONSTRAINT "cities_name_check" CHECK (length(trim("cities"."name")) >= 2),
	CONSTRAINT "cities_latitude_check" CHECK ("cities"."latitude" IS NULL OR ("cities"."latitude" >= -90 AND "cities"."latitude" <= 90)),
	CONSTRAINT "cities_longitude_check" CHECK ("cities"."longitude" IS NULL OR ("cities"."longitude" >= -180 AND "cities"."longitude" <= 180)),
	CONSTRAINT "cities_coordinates_pair_check" CHECK (("cities"."latitude" IS NULL AND "cities"."longitude" IS NULL) OR ("cities"."latitude" IS NOT NULL AND "cities"."longitude" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(2) NOT NULL,
	"iso3" varchar(3) NOT NULL,
	"numeric_code" varchar(3),
	"name" varchar(120) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "countries_code_unique" UNIQUE("code"),
	CONSTRAINT "countries_iso3_unique" UNIQUE("iso3"),
	CONSTRAINT "countries_numeric_code_unique" UNIQUE("numeric_code"),
	CONSTRAINT "countries_code_check" CHECK ("countries"."code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "countries_iso3_check" CHECK ("countries"."iso3" ~ '^[A-Z]{3}$'),
	CONSTRAINT "countries_numeric_code_check" CHECK ("countries"."numeric_code" IS NULL OR "countries"."numeric_code" ~ '^[0-9]{3}$'),
	CONSTRAINT "countries_name_check" CHECK (length(trim("countries"."name")) >= 2)
);
--> statement-breakpoint
CREATE TABLE "document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"subject_scope" varchar(32) NOT NULL,
	"has_expiry" boolean DEFAULT false NOT NULL,
	"requires_validation" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_types_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "document_types_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "document_types_code_check" CHECK (length(trim("document_types"."code")) > 0),
	CONSTRAINT "document_types_name_check" CHECK (length(trim("document_types"."name")) > 0),
	CONSTRAINT "document_types_subject_scope_check" CHECK ("document_types"."subject_scope" in ('party','driver','asset','request','trip','financial','other'))
);
--> statement-breakpoint
ALTER TABLE "document_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "package_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" varchar(300),
	"stackable_default" boolean,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "package_types_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "package_types_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "package_types_code_check" CHECK (length(trim("package_types"."code")) > 0),
	CONSTRAINT "package_types_name_check" CHECK (length(trim("package_types"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "package_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_id" uuid NOT NULL,
	"code" varchar(8) NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "states_country_code_unique" UNIQUE("country_id","code"),
	CONSTRAINT "states_code_check" CHECK ("states"."code" ~ '^[A-Z0-9-]{1,8}$'),
	CONSTRAINT "states_name_check" CHECK (length(trim("states"."name")) >= 2)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" varchar(300),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "tags_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "tags_code_check" CHECK (length(trim("tags"."code")) > 0),
	CONSTRAINT "tags_name_check" CHECK (length(trim("tags"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "units_of_measure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" varchar(80) NOT NULL,
	"dimension" varchar(32) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_of_measure_code_unique" UNIQUE("code"),
	CONSTRAINT "units_of_measure_code_check" CHECK (length(trim("units_of_measure"."code")) > 0),
	CONSTRAINT "units_of_measure_name_check" CHECK (length(trim("units_of_measure"."name")) > 0),
	CONSTRAINT "units_of_measure_dimension_check" CHECK ("units_of_measure"."dimension" in ('mass','volume','length','count','time','other'))
);
--> statement-breakpoint
CREATE TABLE "vehicle_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" varchar(300),
	"default_max_weight_kg" numeric(14, 3),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_types_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "vehicle_types_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "vehicle_types_code_check" CHECK (length(trim("vehicle_types"."code")) > 0),
	CONSTRAINT "vehicle_types_name_check" CHECK (length(trim("vehicle_types"."name")) > 0),
	CONSTRAINT "vehicle_types_weight_check" CHECK ("vehicle_types"."default_max_weight_kg" IS NULL OR "vehicle_types"."default_max_weight_kg" > 0)
);
--> statement-breakpoint
ALTER TABLE "vehicle_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "body_types" ADD CONSTRAINT "body_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_types" ADD CONSTRAINT "cargo_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_state_id_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_types" ADD CONSTRAINT "package_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "states" ADD CONSTRAINT "states_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_types" ADD CONSTRAINT "vehicle_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "body_types_tenant_active_name_idx" ON "body_types" USING btree ("tenant_id","is_active","name");--> statement-breakpoint
CREATE INDEX "cargo_types_tenant_active_name_idx" ON "cargo_types" USING btree ("tenant_id","is_active","name");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_ibge_code_unique" ON "cities" USING btree ("ibge_code") WHERE "cities"."ibge_code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "cities_state_active_name_idx" ON "cities" USING btree ("state_id","is_active","name");--> statement-breakpoint
CREATE INDEX "countries_active_name_idx" ON "countries" USING btree ("is_active","name");--> statement-breakpoint
CREATE INDEX "document_types_tenant_scope_active_idx" ON "document_types" USING btree ("tenant_id","subject_scope","is_active");--> statement-breakpoint
CREATE INDEX "package_types_tenant_active_name_idx" ON "package_types" USING btree ("tenant_id","is_active","name");--> statement-breakpoint
CREATE INDEX "states_country_active_name_idx" ON "states" USING btree ("country_id","is_active","name");--> statement-breakpoint
CREATE INDEX "tags_tenant_active_name_idx" ON "tags" USING btree ("tenant_id","is_active","name");--> statement-breakpoint
CREATE INDEX "units_of_measure_dimension_active_idx" ON "units_of_measure" USING btree ("dimension","is_active");--> statement-breakpoint
CREATE INDEX "vehicle_types_tenant_active_name_idx" ON "vehicle_types" USING btree ("tenant_id","is_active","name");--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "business_party_audit" audit
		LEFT JOIN "users" app_user ON app_user."id" = audit."actor_user_id"
		WHERE app_user."id" IS NULL
	) THEN
		RAISE EXCEPTION 'Wave 0015 blocked: business_party_audit.actor_user_id contains values that do not reference users.id';
	END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "business_party_audit" ADD CONSTRAINT "business_party_audit_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "body_types_tenant_isolation" ON "body_types" AS PERMISSIVE FOR ALL TO public USING ("body_types"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("body_types"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "cargo_types_tenant_isolation" ON "cargo_types" AS PERMISSIVE FOR ALL TO public USING ("cargo_types"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("cargo_types"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "document_types_tenant_isolation" ON "document_types" AS PERMISSIVE FOR ALL TO public USING ("document_types"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("document_types"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "package_types_tenant_isolation" ON "package_types" AS PERMISSIVE FOR ALL TO public USING ("package_types"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("package_types"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tags_tenant_isolation" ON "tags" AS PERMISSIVE FOR ALL TO public USING ("tags"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tags"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "vehicle_types_tenant_isolation" ON "vehicle_types" AS PERMISSIVE FOR ALL TO public USING ("vehicle_types"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("vehicle_types"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT ON TABLE countries, states, cities, units_of_measure TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE vehicle_types, body_types, cargo_types, package_types, document_types, tags TO nexora_app;
