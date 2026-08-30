CREATE TABLE "capacity_asset_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asset_id" uuid NOT NULL,
	"status" varchar(24) DEFAULT 'offline' NOT NULL,
	"available_from" timestamp with time zone,
	"available_until" timestamp with time zone,
	"current_city_id" uuid,
	"notes" varchar(500),
	CONSTRAINT "capacity_asset_availability_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_asset_availability_tenant_asset_unique" UNIQUE("tenant_id","asset_id"),
	CONSTRAINT "capacity_asset_availability_status_check" CHECK ("capacity_asset_availability"."status" in ('available','assigned','maintenance','unavailable','offline')),
	CONSTRAINT "capacity_asset_availability_window_check" CHECK ("capacity_asset_availability"."available_from" IS NULL OR "capacity_asset_availability"."available_until" IS NULL OR "capacity_asset_availability"."available_until" >= "capacity_asset_availability"."available_from")
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_availability" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_asset_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asset_id" uuid NOT NULL,
	"reason_code" varchar(64) NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"severity" varchar(16) DEFAULT 'operational' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"released_by_user_id" uuid,
	"release_reason" varchar(1000),
	CONSTRAINT "capacity_asset_blocks_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_asset_blocks_reason_code_check" CHECK (length(trim("capacity_asset_blocks"."reason_code")) > 0),
	CONSTRAINT "capacity_asset_blocks_reason_check" CHECK (length(trim("capacity_asset_blocks"."reason")) > 0),
	CONSTRAINT "capacity_asset_blocks_severity_check" CHECK ("capacity_asset_blocks"."severity" in ('operational','compliance','legal','safety','maintenance')),
	CONSTRAINT "capacity_asset_blocks_period_check" CHECK ("capacity_asset_blocks"."ends_at" IS NULL OR "capacity_asset_blocks"."ends_at" > "capacity_asset_blocks"."starts_at"),
	CONSTRAINT "capacity_asset_blocks_release_check" CHECK (("capacity_asset_blocks"."released_at" IS NULL AND "capacity_asset_blocks"."released_by_user_id" IS NULL) OR ("capacity_asset_blocks"."released_at" IS NOT NULL AND "capacity_asset_blocks"."released_by_user_id" IS NOT NULL AND "capacity_asset_blocks"."release_reason" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_asset_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asset_id" uuid NOT NULL,
	"refrigerated" boolean DEFAULT false NOT NULL,
	"sealed" boolean DEFAULT false NOT NULL,
	"side_loading" boolean DEFAULT false NOT NULL,
	"rear_loading" boolean DEFAULT false NOT NULL,
	"dangerous_goods" boolean DEFAULT false NOT NULL,
	"food_grade" boolean DEFAULT false NOT NULL,
	"tracking_capable" boolean DEFAULT false NOT NULL,
	"max_pallets" integer,
	"min_temperature_c" numeric(6, 2),
	"max_temperature_c" numeric(6, 2),
	CONSTRAINT "capacity_asset_capabilities_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_asset_capabilities_tenant_asset_unique" UNIQUE("tenant_id","asset_id"),
	CONSTRAINT "capacity_asset_capabilities_pallets_check" CHECK ("capacity_asset_capabilities"."max_pallets" IS NULL OR "capacity_asset_capabilities"."max_pallets" > 0),
	CONSTRAINT "capacity_asset_capabilities_temperature_check" CHECK ("capacity_asset_capabilities"."min_temperature_c" IS NULL OR "capacity_asset_capabilities"."max_temperature_c" IS NULL OR "capacity_asset_capabilities"."min_temperature_c" <= "capacity_asset_capabilities"."max_temperature_c")
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_capabilities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_asset_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asset_id" uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"document_number" varchar(120),
	"issuer" varchar(180),
	"issued_on" date,
	"expires_on" date,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"validation_status" varchar(24) DEFAULT 'pending' NOT NULL,
	"notes" varchar(1000),
	CONSTRAINT "capacity_asset_documents_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_asset_documents_dates_check" CHECK ("capacity_asset_documents"."issued_on" IS NULL OR "capacity_asset_documents"."expires_on" IS NULL OR "capacity_asset_documents"."expires_on" >= "capacity_asset_documents"."issued_on"),
	CONSTRAINT "capacity_asset_documents_status_check" CHECK ("capacity_asset_documents"."status" in ('pending','valid','expired','blocked','inactive')),
	CONSTRAINT "capacity_asset_documents_validation_status_check" CHECK ("capacity_asset_documents"."validation_status" in ('pending','validated','rejected','not_required'))
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_asset_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asset_id" uuid NOT NULL,
	"inspection_type" varchar(64) NOT NULL,
	"inspector_user_id" uuid,
	"performed_at" timestamp with time zone NOT NULL,
	"result" varchar(24) NOT NULL,
	"status" varchar(24) DEFAULT 'finalized' NOT NULL,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" varchar(1500),
	"next_due_at" timestamp with time zone,
	CONSTRAINT "capacity_asset_inspections_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_asset_inspections_result_check" CHECK ("capacity_asset_inspections"."result" in ('passed','failed','conditional','not_applicable')),
	CONSTRAINT "capacity_asset_inspections_status_check" CHECK ("capacity_asset_inspections"."status" in ('draft','finalized','cancelled')),
	CONSTRAINT "capacity_asset_inspections_next_due_check" CHECK ("capacity_asset_inspections"."next_due_at" IS NULL OR "capacity_asset_inspections"."next_due_at" >= "capacity_asset_inspections"."performed_at")
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_inspections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_asset_insurances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asset_id" uuid NOT NULL,
	"insurer_party_id" uuid,
	"policy_number" varchar(120) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"coverage_amount" numeric(18, 2),
	"currency_id" uuid,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"notes" varchar(1000),
	CONSTRAINT "capacity_asset_insurances_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_asset_insurances_tenant_policy_unique" UNIQUE("tenant_id","policy_number"),
	CONSTRAINT "capacity_asset_insurances_period_check" CHECK ("capacity_asset_insurances"."ends_on" >= "capacity_asset_insurances"."starts_on"),
	CONSTRAINT "capacity_asset_insurances_coverage_check" CHECK ("capacity_asset_insurances"."coverage_amount" IS NULL OR "capacity_asset_insurances"."coverage_amount" >= 0),
	CONSTRAINT "capacity_asset_insurances_currency_check" CHECK ("capacity_asset_insurances"."coverage_amount" IS NULL OR "capacity_asset_insurances"."currency_id" IS NOT NULL),
	CONSTRAINT "capacity_asset_insurances_status_check" CHECK ("capacity_asset_insurances"."status" in ('pending','active','expired','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_insurances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_asset_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"city_id" uuid,
	"observed_at" timestamp with time zone NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(10, 6) NOT NULL,
	"source" varchar(32) NOT NULL,
	"accuracy_m" numeric(10, 2),
	"provider_reference" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capacity_asset_locations_latitude_check" CHECK ("capacity_asset_locations"."latitude" >= -90 AND "capacity_asset_locations"."latitude" <= 90),
	CONSTRAINT "capacity_asset_locations_longitude_check" CHECK ("capacity_asset_locations"."longitude" >= -180 AND "capacity_asset_locations"."longitude" <= 180),
	CONSTRAINT "capacity_asset_locations_source_check" CHECK ("capacity_asset_locations"."source" in ('gps','mobile','manual','integration','telematics')),
	CONSTRAINT "capacity_asset_locations_accuracy_check" CHECK ("capacity_asset_locations"."accuracy_m" IS NULL OR "capacity_asset_locations"."accuracy_m" >= 0)
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_asset_maintenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asset_id" uuid NOT NULL,
	"maintenance_plan_id" uuid,
	"provider_party_id" uuid,
	"maintenance_type" varchar(64) NOT NULL,
	"status" varchar(24) DEFAULT 'planned' NOT NULL,
	"planned_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"odometer_km" numeric(14, 1),
	"total_cost" numeric(18, 2),
	"currency_id" uuid,
	"notes" varchar(1500),
	CONSTRAINT "capacity_asset_maintenance_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_asset_maintenance_status_check" CHECK ("capacity_asset_maintenance"."status" in ('planned','in_progress','completed','cancelled')),
	CONSTRAINT "capacity_asset_maintenance_odometer_check" CHECK ("capacity_asset_maintenance"."odometer_km" IS NULL OR "capacity_asset_maintenance"."odometer_km" >= 0),
	CONSTRAINT "capacity_asset_maintenance_cost_check" CHECK ("capacity_asset_maintenance"."total_cost" IS NULL OR "capacity_asset_maintenance"."total_cost" >= 0),
	CONSTRAINT "capacity_asset_maintenance_currency_check" CHECK ("capacity_asset_maintenance"."total_cost" IS NULL OR "capacity_asset_maintenance"."currency_id" IS NOT NULL),
	CONSTRAINT "capacity_asset_maintenance_time_check" CHECK (("capacity_asset_maintenance"."started_at" IS NULL OR "capacity_asset_maintenance"."planned_at" IS NULL OR "capacity_asset_maintenance"."started_at" >= "capacity_asset_maintenance"."planned_at") AND ("capacity_asset_maintenance"."completed_at" IS NULL OR "capacity_asset_maintenance"."started_at" IS NULL OR "capacity_asset_maintenance"."completed_at" >= "capacity_asset_maintenance"."started_at"))
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_asset_maintenance_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"maintenance_id" uuid NOT NULL,
	"item_type" varchar(64) NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" numeric(14, 3) DEFAULT '1' NOT NULL,
	"unit_amount" numeric(18, 2),
	"total_amount" numeric(18, 2),
	"currency_id" uuid,
	CONSTRAINT "capacity_asset_maintenance_items_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_asset_maintenance_items_quantity_check" CHECK ("capacity_asset_maintenance_items"."quantity" > 0),
	CONSTRAINT "capacity_asset_maintenance_items_amount_check" CHECK (("capacity_asset_maintenance_items"."unit_amount" IS NULL OR "capacity_asset_maintenance_items"."unit_amount" >= 0) AND ("capacity_asset_maintenance_items"."total_amount" IS NULL OR "capacity_asset_maintenance_items"."total_amount" >= 0)),
	CONSTRAINT "capacity_asset_maintenance_items_currency_check" CHECK (("capacity_asset_maintenance_items"."unit_amount" IS NULL AND "capacity_asset_maintenance_items"."total_amount" IS NULL) OR "capacity_asset_maintenance_items"."currency_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_asset_maintenance_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asset_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"maintenance_type" varchar(64) NOT NULL,
	"interval_days" integer,
	"interval_odometer_km" numeric(14, 1),
	"next_due_on" date,
	"next_due_odometer_km" numeric(14, 1),
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" varchar(1000),
	CONSTRAINT "capacity_asset_maintenance_plans_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_asset_maintenance_plans_name_check" CHECK (length(trim("capacity_asset_maintenance_plans"."name")) > 0),
	CONSTRAINT "capacity_asset_maintenance_plans_type_check" CHECK (length(trim("capacity_asset_maintenance_plans"."maintenance_type")) > 0),
	CONSTRAINT "capacity_asset_maintenance_plans_interval_check" CHECK (("capacity_asset_maintenance_plans"."interval_days" IS NOT NULL AND "capacity_asset_maintenance_plans"."interval_days" > 0) OR ("capacity_asset_maintenance_plans"."interval_odometer_km" IS NOT NULL AND "capacity_asset_maintenance_plans"."interval_odometer_km" > 0)),
	CONSTRAINT "capacity_asset_maintenance_plans_next_odometer_check" CHECK ("capacity_asset_maintenance_plans"."next_due_odometer_km" IS NULL OR "capacity_asset_maintenance_plans"."next_due_odometer_km" >= 0)
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacity_asset_unavailability_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asset_id" uuid NOT NULL,
	"reason_code" varchar(64) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" varchar(24) DEFAULT 'scheduled' NOT NULL,
	CONSTRAINT "capacity_asset_unavailability_periods_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "capacity_asset_unavailability_periods_reason_code_check" CHECK (length(trim("capacity_asset_unavailability_periods"."reason_code")) > 0),
	CONSTRAINT "capacity_asset_unavailability_periods_reason_check" CHECK (length(trim("capacity_asset_unavailability_periods"."reason")) > 0),
	CONSTRAINT "capacity_asset_unavailability_periods_window_check" CHECK ("capacity_asset_unavailability_periods"."ends_at" > "capacity_asset_unavailability_periods"."starts_at"),
	CONSTRAINT "capacity_asset_unavailability_periods_status_check" CHECK ("capacity_asset_unavailability_periods"."status" in ('scheduled','active','completed','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "capacity_asset_unavailability_periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"driver_id" uuid NOT NULL,
	"status" varchar(24) DEFAULT 'offline' NOT NULL,
	"available_from" timestamp with time zone,
	"available_until" timestamp with time zone,
	"current_city_id" uuid,
	"destination_city_id" uuid,
	"max_distance_km" numeric(10, 2),
	"notes" varchar(500),
	CONSTRAINT "driver_availability_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "driver_availability_tenant_driver_unique" UNIQUE("tenant_id","driver_id"),
	CONSTRAINT "driver_availability_status_check" CHECK ("driver_availability"."status" in ('available','assigned','unavailable','offline')),
	CONSTRAINT "driver_availability_window_check" CHECK ("driver_availability"."available_from" IS NULL OR "driver_availability"."available_until" IS NULL OR "driver_availability"."available_until" >= "driver_availability"."available_from"),
	CONSTRAINT "driver_availability_distance_check" CHECK ("driver_availability"."max_distance_km" IS NULL OR "driver_availability"."max_distance_km" >= 0)
);
--> statement-breakpoint
ALTER TABLE "driver_availability" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"driver_id" uuid NOT NULL,
	"reason_code" varchar(64) NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"severity" varchar(16) DEFAULT 'operational' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"released_by_user_id" uuid,
	"release_reason" varchar(1000),
	CONSTRAINT "driver_blocks_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "driver_blocks_reason_code_check" CHECK (length(trim("driver_blocks"."reason_code")) > 0),
	CONSTRAINT "driver_blocks_reason_check" CHECK (length(trim("driver_blocks"."reason")) > 0),
	CONSTRAINT "driver_blocks_severity_check" CHECK ("driver_blocks"."severity" in ('operational','compliance','legal','safety')),
	CONSTRAINT "driver_blocks_period_check" CHECK ("driver_blocks"."ends_at" IS NULL OR "driver_blocks"."ends_at" > "driver_blocks"."starts_at"),
	CONSTRAINT "driver_blocks_release_check" CHECK (("driver_blocks"."released_at" IS NULL AND "driver_blocks"."released_by_user_id" IS NULL) OR ("driver_blocks"."released_at" IS NOT NULL AND "driver_blocks"."released_by_user_id" IS NOT NULL AND "driver_blocks"."release_reason" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "driver_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"driver_id" uuid NOT NULL,
	"course_code" varchar(80) NOT NULL,
	"course_name" varchar(200) NOT NULL,
	"provider" varchar(180),
	"certificate_number" varchar(120),
	"completed_on" date NOT NULL,
	"expires_on" date,
	"workload_hours" numeric(8, 2),
	"status" varchar(24) DEFAULT 'valid' NOT NULL,
	"notes" varchar(1000),
	CONSTRAINT "driver_courses_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "driver_courses_code_check" CHECK (length(trim("driver_courses"."course_code")) > 0),
	CONSTRAINT "driver_courses_name_check" CHECK (length(trim("driver_courses"."course_name")) > 0),
	CONSTRAINT "driver_courses_expiry_check" CHECK ("driver_courses"."expires_on" IS NULL OR "driver_courses"."expires_on" >= "driver_courses"."completed_on"),
	CONSTRAINT "driver_courses_workload_check" CHECK ("driver_courses"."workload_hours" IS NULL OR "driver_courses"."workload_hours" > 0),
	CONSTRAINT "driver_courses_status_check" CHECK ("driver_courses"."status" in ('pending','valid','expired','blocked','inactive'))
);
--> statement-breakpoint
ALTER TABLE "driver_courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"driver_id" uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"document_number" varchar(120),
	"issuer" varchar(180),
	"issued_on" date,
	"expires_on" date,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"validation_status" varchar(24) DEFAULT 'pending' NOT NULL,
	"notes" varchar(1000),
	CONSTRAINT "driver_documents_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "driver_documents_dates_check" CHECK ("driver_documents"."issued_on" IS NULL OR "driver_documents"."expires_on" IS NULL OR "driver_documents"."expires_on" >= "driver_documents"."issued_on"),
	CONSTRAINT "driver_documents_status_check" CHECK ("driver_documents"."status" in ('pending','valid','expired','blocked','inactive')),
	CONSTRAINT "driver_documents_validation_status_check" CHECK ("driver_documents"."validation_status" in ('pending','validated','rejected','not_required'))
);
--> statement-breakpoint
ALTER TABLE "driver_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_emergency_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"driver_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"relationship" varchar(80),
	"phone" varchar(32) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "driver_emergency_contacts_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "driver_emergency_contacts_name_check" CHECK (length(trim("driver_emergency_contacts"."name")) >= 2),
	CONSTRAINT "driver_emergency_contacts_phone_check" CHECK (length(trim("driver_emergency_contacts"."phone")) >= 8)
);
--> statement-breakpoint
ALTER TABLE "driver_emergency_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_qualifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"driver_id" uuid NOT NULL,
	"qualification_type" varchar(64) NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(180) NOT NULL,
	"certificate_number" varchar(120),
	"issuer" varchar(180),
	"issued_on" date,
	"expires_on" date,
	"status" varchar(24) DEFAULT 'valid' NOT NULL,
	"notes" varchar(1000),
	CONSTRAINT "driver_qualifications_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "driver_qualifications_tenant_driver_code_unique" UNIQUE("tenant_id","driver_id","code"),
	CONSTRAINT "driver_qualifications_type_check" CHECK ("driver_qualifications"."qualification_type" in ('license','endorsement','certification','authorization','other')),
	CONSTRAINT "driver_qualifications_code_check" CHECK (length(trim("driver_qualifications"."code")) > 0),
	CONSTRAINT "driver_qualifications_name_check" CHECK (length(trim("driver_qualifications"."name")) > 0),
	CONSTRAINT "driver_qualifications_dates_check" CHECK ("driver_qualifications"."issued_on" IS NULL OR "driver_qualifications"."expires_on" IS NULL OR "driver_qualifications"."expires_on" >= "driver_qualifications"."issued_on"),
	CONSTRAINT "driver_qualifications_status_check" CHECK ("driver_qualifications"."status" in ('pending','valid','expired','blocked','inactive'))
);
--> statement-breakpoint
ALTER TABLE "driver_qualifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"transport_request_id" uuid,
	"dimension" varchar(64) NOT NULL,
	"score" numeric(4, 2) NOT NULL,
	"note" varchar(1000),
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_ratings_dimension_check" CHECK (length(trim("driver_ratings"."dimension")) > 0),
	CONSTRAINT "driver_ratings_score_check" CHECK ("driver_ratings"."score" >= 0 AND "driver_ratings"."score" <= 5)
);
--> statement-breakpoint
ALTER TABLE "driver_ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driver_unavailability_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"driver_id" uuid NOT NULL,
	"reason_code" varchar(64) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" varchar(24) DEFAULT 'scheduled' NOT NULL,
	CONSTRAINT "driver_unavailability_periods_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "driver_unavailability_periods_reason_code_check" CHECK (length(trim("driver_unavailability_periods"."reason_code")) > 0),
	CONSTRAINT "driver_unavailability_periods_reason_check" CHECK (length(trim("driver_unavailability_periods"."reason")) > 0),
	CONSTRAINT "driver_unavailability_periods_window_check" CHECK ("driver_unavailability_periods"."ends_at" > "driver_unavailability_periods"."starts_at"),
	CONSTRAINT "driver_unavailability_periods_status_check" CHECK ("driver_unavailability_periods"."status" in ('scheduled','active','completed','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "driver_unavailability_periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "capacity_assets" ADD COLUMN "vehicle_type_id" uuid;--> statement-breakpoint
ALTER TABLE "capacity_assets" ADD COLUMN "body_type_id" uuid;--> statement-breakpoint
ALTER TABLE "capacity_asset_availability" ADD CONSTRAINT "capacity_asset_availability_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_availability" ADD CONSTRAINT "capacity_asset_availability_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_availability" ADD CONSTRAINT "capacity_asset_availability_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_availability" ADD CONSTRAINT "capacity_asset_availability_current_city_id_cities_id_fk" FOREIGN KEY ("current_city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_availability" ADD CONSTRAINT "capacity_asset_availability_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_blocks" ADD CONSTRAINT "capacity_asset_blocks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_blocks" ADD CONSTRAINT "capacity_asset_blocks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_blocks" ADD CONSTRAINT "capacity_asset_blocks_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_blocks" ADD CONSTRAINT "capacity_asset_blocks_released_by_user_id_users_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_blocks" ADD CONSTRAINT "capacity_asset_blocks_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_capabilities" ADD CONSTRAINT "capacity_asset_capabilities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_capabilities" ADD CONSTRAINT "capacity_asset_capabilities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_capabilities" ADD CONSTRAINT "capacity_asset_capabilities_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_capabilities" ADD CONSTRAINT "capacity_asset_capabilities_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_documents" ADD CONSTRAINT "capacity_asset_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_documents" ADD CONSTRAINT "capacity_asset_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_documents" ADD CONSTRAINT "capacity_asset_documents_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_documents" ADD CONSTRAINT "capacity_asset_documents_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_documents" ADD CONSTRAINT "capacity_asset_documents_document_type_fk" FOREIGN KEY ("tenant_id","document_type_id") REFERENCES "public"."document_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_inspections" ADD CONSTRAINT "capacity_asset_inspections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_inspections" ADD CONSTRAINT "capacity_asset_inspections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_inspections" ADD CONSTRAINT "capacity_asset_inspections_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_inspections" ADD CONSTRAINT "capacity_asset_inspections_inspector_user_id_users_id_fk" FOREIGN KEY ("inspector_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_inspections" ADD CONSTRAINT "capacity_asset_inspections_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_insurances" ADD CONSTRAINT "capacity_asset_insurances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_insurances" ADD CONSTRAINT "capacity_asset_insurances_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_insurances" ADD CONSTRAINT "capacity_asset_insurances_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_insurances" ADD CONSTRAINT "capacity_asset_insurances_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_insurances" ADD CONSTRAINT "capacity_asset_insurances_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_insurances" ADD CONSTRAINT "capacity_asset_insurances_insurer_fk" FOREIGN KEY ("tenant_id","insurer_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_locations" ADD CONSTRAINT "capacity_asset_locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_locations" ADD CONSTRAINT "capacity_asset_locations_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_locations" ADD CONSTRAINT "capacity_asset_locations_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance" ADD CONSTRAINT "capacity_asset_maintenance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance" ADD CONSTRAINT "capacity_asset_maintenance_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance" ADD CONSTRAINT "capacity_asset_maintenance_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance" ADD CONSTRAINT "capacity_asset_maintenance_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance" ADD CONSTRAINT "capacity_asset_maintenance_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance" ADD CONSTRAINT "capacity_asset_maintenance_plan_fk" FOREIGN KEY ("tenant_id","maintenance_plan_id") REFERENCES "public"."capacity_asset_maintenance_plans"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance" ADD CONSTRAINT "capacity_asset_maintenance_provider_fk" FOREIGN KEY ("tenant_id","provider_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance_items" ADD CONSTRAINT "capacity_asset_maintenance_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance_items" ADD CONSTRAINT "capacity_asset_maintenance_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance_items" ADD CONSTRAINT "capacity_asset_maintenance_items_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance_items" ADD CONSTRAINT "capacity_asset_maintenance_items_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance_items" ADD CONSTRAINT "capacity_asset_maintenance_items_maintenance_fk" FOREIGN KEY ("tenant_id","maintenance_id") REFERENCES "public"."capacity_asset_maintenance"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance_plans" ADD CONSTRAINT "capacity_asset_maintenance_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance_plans" ADD CONSTRAINT "capacity_asset_maintenance_plans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance_plans" ADD CONSTRAINT "capacity_asset_maintenance_plans_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_maintenance_plans" ADD CONSTRAINT "capacity_asset_maintenance_plans_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_unavailability_periods" ADD CONSTRAINT "capacity_asset_unavailability_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_unavailability_periods" ADD CONSTRAINT "capacity_asset_unavailability_periods_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_unavailability_periods" ADD CONSTRAINT "capacity_asset_unavailability_periods_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_asset_unavailability_periods" ADD CONSTRAINT "capacity_asset_unavailability_periods_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_availability" ADD CONSTRAINT "driver_availability_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_availability" ADD CONSTRAINT "driver_availability_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_availability" ADD CONSTRAINT "driver_availability_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_availability" ADD CONSTRAINT "driver_availability_current_city_id_cities_id_fk" FOREIGN KEY ("current_city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_availability" ADD CONSTRAINT "driver_availability_destination_city_id_cities_id_fk" FOREIGN KEY ("destination_city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_availability" ADD CONSTRAINT "driver_availability_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_blocks" ADD CONSTRAINT "driver_blocks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_blocks" ADD CONSTRAINT "driver_blocks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_blocks" ADD CONSTRAINT "driver_blocks_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_blocks" ADD CONSTRAINT "driver_blocks_released_by_user_id_users_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_blocks" ADD CONSTRAINT "driver_blocks_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_courses" ADD CONSTRAINT "driver_courses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_courses" ADD CONSTRAINT "driver_courses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_courses" ADD CONSTRAINT "driver_courses_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_courses" ADD CONSTRAINT "driver_courses_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_document_type_fk" FOREIGN KEY ("tenant_id","document_type_id") REFERENCES "public"."document_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_emergency_contacts" ADD CONSTRAINT "driver_emergency_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_emergency_contacts" ADD CONSTRAINT "driver_emergency_contacts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_emergency_contacts" ADD CONSTRAINT "driver_emergency_contacts_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_emergency_contacts" ADD CONSTRAINT "driver_emergency_contacts_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_qualifications" ADD CONSTRAINT "driver_qualifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_qualifications" ADD CONSTRAINT "driver_qualifications_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_qualifications" ADD CONSTRAINT "driver_qualifications_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_qualifications" ADD CONSTRAINT "driver_qualifications_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_ratings" ADD CONSTRAINT "driver_ratings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_ratings" ADD CONSTRAINT "driver_ratings_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_ratings" ADD CONSTRAINT "driver_ratings_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_ratings" ADD CONSTRAINT "driver_ratings_transport_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_unavailability_periods" ADD CONSTRAINT "driver_unavailability_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_unavailability_periods" ADD CONSTRAINT "driver_unavailability_periods_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_unavailability_periods" ADD CONSTRAINT "driver_unavailability_periods_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_unavailability_periods" ADD CONSTRAINT "driver_unavailability_periods_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capacity_asset_availability_tenant_status_city_idx" ON "capacity_asset_availability" USING btree ("tenant_id","status","current_city_id");--> statement-breakpoint
CREATE INDEX "capacity_asset_blocks_tenant_asset_active_idx" ON "capacity_asset_blocks" USING btree ("tenant_id","asset_id","released_at");--> statement-breakpoint
CREATE INDEX "capacity_asset_capabilities_tenant_tracking_idx" ON "capacity_asset_capabilities" USING btree ("tenant_id","tracking_capable");--> statement-breakpoint
CREATE INDEX "capacity_asset_documents_tenant_asset_status_idx" ON "capacity_asset_documents" USING btree ("tenant_id","asset_id","status");--> statement-breakpoint
CREATE INDEX "capacity_asset_documents_tenant_expiry_idx" ON "capacity_asset_documents" USING btree ("tenant_id","expires_on");--> statement-breakpoint
CREATE INDEX "capacity_asset_inspections_tenant_asset_time_idx" ON "capacity_asset_inspections" USING btree ("tenant_id","asset_id","performed_at");--> statement-breakpoint
CREATE INDEX "capacity_asset_inspections_tenant_due_idx" ON "capacity_asset_inspections" USING btree ("tenant_id","next_due_at");--> statement-breakpoint
CREATE INDEX "capacity_asset_insurances_tenant_asset_status_idx" ON "capacity_asset_insurances" USING btree ("tenant_id","asset_id","status");--> statement-breakpoint
CREATE INDEX "capacity_asset_insurances_tenant_expiry_idx" ON "capacity_asset_insurances" USING btree ("tenant_id","ends_on");--> statement-breakpoint
CREATE INDEX "capacity_asset_locations_tenant_asset_time_idx" ON "capacity_asset_locations" USING btree ("tenant_id","asset_id","observed_at");--> statement-breakpoint
CREATE INDEX "capacity_asset_locations_tenant_time_idx" ON "capacity_asset_locations" USING btree ("tenant_id","observed_at");--> statement-breakpoint
CREATE INDEX "capacity_asset_maintenance_tenant_asset_status_idx" ON "capacity_asset_maintenance" USING btree ("tenant_id","asset_id","status");--> statement-breakpoint
CREATE INDEX "capacity_asset_maintenance_tenant_planned_idx" ON "capacity_asset_maintenance" USING btree ("tenant_id","planned_at");--> statement-breakpoint
CREATE INDEX "capacity_asset_maintenance_items_tenant_maintenance_idx" ON "capacity_asset_maintenance_items" USING btree ("tenant_id","maintenance_id");--> statement-breakpoint
CREATE INDEX "capacity_asset_maintenance_plans_tenant_asset_active_idx" ON "capacity_asset_maintenance_plans" USING btree ("tenant_id","asset_id","is_active");--> statement-breakpoint
CREATE INDEX "capacity_asset_maintenance_plans_tenant_due_idx" ON "capacity_asset_maintenance_plans" USING btree ("tenant_id","next_due_on");--> statement-breakpoint
CREATE INDEX "capacity_asset_unavailability_periods_tenant_asset_window_idx" ON "capacity_asset_unavailability_periods" USING btree ("tenant_id","asset_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "driver_availability_tenant_status_city_idx" ON "driver_availability" USING btree ("tenant_id","status","current_city_id");--> statement-breakpoint
CREATE INDEX "driver_blocks_tenant_driver_active_idx" ON "driver_blocks" USING btree ("tenant_id","driver_id","released_at");--> statement-breakpoint
CREATE INDEX "driver_courses_tenant_driver_status_idx" ON "driver_courses" USING btree ("tenant_id","driver_id","status");--> statement-breakpoint
CREATE INDEX "driver_courses_tenant_expiry_idx" ON "driver_courses" USING btree ("tenant_id","expires_on");--> statement-breakpoint
CREATE INDEX "driver_documents_tenant_driver_status_idx" ON "driver_documents" USING btree ("tenant_id","driver_id","status");--> statement-breakpoint
CREATE INDEX "driver_documents_tenant_expiry_idx" ON "driver_documents" USING btree ("tenant_id","expires_on");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_emergency_contacts_primary_unique" ON "driver_emergency_contacts" USING btree ("tenant_id","driver_id") WHERE "driver_emergency_contacts"."is_primary" = true AND "driver_emergency_contacts"."is_active" = true;--> statement-breakpoint
CREATE INDEX "driver_emergency_contacts_tenant_driver_active_idx" ON "driver_emergency_contacts" USING btree ("tenant_id","driver_id","is_active");--> statement-breakpoint
CREATE INDEX "driver_qualifications_tenant_driver_status_idx" ON "driver_qualifications" USING btree ("tenant_id","driver_id","status");--> statement-breakpoint
CREATE INDEX "driver_qualifications_tenant_expiry_idx" ON "driver_qualifications" USING btree ("tenant_id","expires_on");--> statement-breakpoint
CREATE INDEX "driver_ratings_tenant_driver_dimension_time_idx" ON "driver_ratings" USING btree ("tenant_id","driver_id","dimension","created_at");--> statement-breakpoint
CREATE INDEX "driver_unavailability_periods_tenant_driver_window_idx" ON "driver_unavailability_periods" USING btree ("tenant_id","driver_id","starts_at","ends_at");--> statement-breakpoint
ALTER TABLE "capacity_assets" ADD CONSTRAINT "capacity_assets_vehicle_type_fk" FOREIGN KEY ("tenant_id","vehicle_type_id") REFERENCES "public"."vehicle_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_assets" ADD CONSTRAINT "capacity_assets_body_type_fk" FOREIGN KEY ("tenant_id","body_type_id") REFERENCES "public"."body_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capacity_assets_tenant_vehicle_body_catalog_idx" ON "capacity_assets" USING btree ("tenant_id","vehicle_type_id","body_type_id");--> statement-breakpoint
CREATE POLICY "capacity_asset_availability_tenant_isolation" ON "capacity_asset_availability" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_availability"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_availability"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_asset_blocks_tenant_isolation" ON "capacity_asset_blocks" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_blocks"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_blocks"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_asset_capabilities_tenant_isolation" ON "capacity_asset_capabilities" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_capabilities"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_capabilities"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_asset_documents_tenant_isolation" ON "capacity_asset_documents" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_asset_inspections_tenant_isolation" ON "capacity_asset_inspections" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_inspections"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_inspections"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_asset_insurances_tenant_isolation" ON "capacity_asset_insurances" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_insurances"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_insurances"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_asset_locations_tenant_isolation" ON "capacity_asset_locations" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_locations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_locations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_asset_maintenance_tenant_isolation" ON "capacity_asset_maintenance" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_maintenance"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_maintenance"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_asset_maintenance_items_tenant_isolation" ON "capacity_asset_maintenance_items" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_maintenance_items"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_maintenance_items"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_asset_maintenance_plans_tenant_isolation" ON "capacity_asset_maintenance_plans" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_maintenance_plans"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_maintenance_plans"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacity_asset_unavailability_periods_tenant_isolation" ON "capacity_asset_unavailability_periods" AS PERMISSIVE FOR ALL TO public USING ("capacity_asset_unavailability_periods"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("capacity_asset_unavailability_periods"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "driver_availability_tenant_isolation" ON "driver_availability" AS PERMISSIVE FOR ALL TO public USING ("driver_availability"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("driver_availability"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "driver_blocks_tenant_isolation" ON "driver_blocks" AS PERMISSIVE FOR ALL TO public USING ("driver_blocks"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("driver_blocks"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "driver_courses_tenant_isolation" ON "driver_courses" AS PERMISSIVE FOR ALL TO public USING ("driver_courses"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("driver_courses"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "driver_documents_tenant_isolation" ON "driver_documents" AS PERMISSIVE FOR ALL TO public USING ("driver_documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("driver_documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "driver_emergency_contacts_tenant_isolation" ON "driver_emergency_contacts" AS PERMISSIVE FOR ALL TO public USING ("driver_emergency_contacts"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("driver_emergency_contacts"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "driver_qualifications_tenant_isolation" ON "driver_qualifications" AS PERMISSIVE FOR ALL TO public USING ("driver_qualifications"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("driver_qualifications"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "driver_ratings_tenant_isolation" ON "driver_ratings" AS PERMISSIVE FOR ALL TO public USING ("driver_ratings"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("driver_ratings"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "driver_unavailability_periods_tenant_isolation" ON "driver_unavailability_periods" AS PERMISSIVE FOR ALL TO public USING ("driver_unavailability_periods"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("driver_unavailability_periods"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
-- Wave 0017 runtime privileges. RLS remains the row-level authorization boundary.
GRANT SELECT, INSERT, UPDATE ON TABLE
  driver_documents,
  driver_qualifications,
  driver_courses,
  driver_availability,
  driver_unavailability_periods,
  driver_emergency_contacts,
  driver_blocks,
  capacity_asset_capabilities,
  capacity_asset_documents,
  capacity_asset_maintenance_plans,
  capacity_asset_maintenance,
  capacity_asset_maintenance_items,
  capacity_asset_insurances,
  capacity_asset_inspections,
  capacity_asset_availability,
  capacity_asset_unavailability_periods,
  capacity_asset_blocks
TO nexora_app;

GRANT SELECT, INSERT ON TABLE
  driver_ratings,
  capacity_asset_locations
TO nexora_app;
