CREATE TABLE "business_party_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"business_party_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"relation_type" varchar(32) DEFAULT 'registration' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_party_documents_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "business_party_documents_tenant_party_document_unique" UNIQUE("tenant_id","business_party_id","document_id"),
	CONSTRAINT "business_party_documents_relation_check" CHECK ("business_party_documents"."relation_type" in ('registration','compliance','contract','insurance','other'))
);
--> statement-breakpoint
ALTER TABLE "business_party_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_version_id" uuid,
	"validation_type" varchar(32) NOT NULL,
	"result" varchar(24) NOT NULL,
	"notes" varchar(1500),
	"provider_reference" varchar(180),
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"validated_by_user_id" uuid,
	"validated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_validations_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "document_validations_type_check" CHECK ("document_validations"."validation_type" in ('manual','system','external')),
	CONSTRAINT "document_validations_result_check" CHECK ("document_validations"."result" in ('valid','invalid','review_required')),
	CONSTRAINT "document_validations_actor_check" CHECK ("document_validations"."validation_type" <> 'manual' OR "document_validations"."validated_by_user_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "document_validations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"original_file_name" varchar(255) NOT NULL,
	"mime_type" varchar(160) NOT NULL,
	"byte_size" numeric(20, 0) NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"storage_provider" varchar(64) NOT NULL,
	"storage_key" varchar(700) NOT NULL,
	"source" varchar(24) DEFAULT 'upload' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "document_versions_tenant_document_id_id_unique" UNIQUE("tenant_id","document_id","id"),
	CONSTRAINT "document_versions_tenant_document_version_unique" UNIQUE("tenant_id","document_id","version_number"),
	CONSTRAINT "document_versions_tenant_storage_object_unique" UNIQUE("tenant_id","storage_provider","storage_key"),
	CONSTRAINT "document_versions_number_check" CHECK ("document_versions"."version_number" > 0),
	CONSTRAINT "document_versions_file_name_check" CHECK (length(trim("document_versions"."original_file_name")) > 0),
	CONSTRAINT "document_versions_mime_type_check" CHECK (length(trim("document_versions"."mime_type")) > 0),
	CONSTRAINT "document_versions_byte_size_check" CHECK ("document_versions"."byte_size" > 0),
	CONSTRAINT "document_versions_checksum_check" CHECK ("document_versions"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "document_versions_storage_provider_check" CHECK (length(trim("document_versions"."storage_provider")) > 0),
	CONSTRAINT "document_versions_storage_key_check" CHECK (length(trim("document_versions"."storage_key")) > 0),
	CONSTRAINT "document_versions_source_check" CHECK ("document_versions"."source" in ('upload','import','generated','integration'))
);
--> statement-breakpoint
ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"title" varchar(240) NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"issued_on" date,
	"expires_on" date,
	"external_reference" varchar(180),
	"notes" varchar(1500),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"delete_reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "documents_title_check" CHECK (length(trim("documents"."title")) > 0),
	CONSTRAINT "documents_status_check" CHECK ("documents"."status" in ('draft','pending','valid','rejected','expired','archived')),
	CONSTRAINT "documents_dates_check" CHECK ("documents"."issued_on" IS NULL OR "documents"."expires_on" IS NULL OR "documents"."expires_on" >= "documents"."issued_on"),
	CONSTRAINT "documents_soft_delete_check" CHECK (("documents"."deleted_at" IS NULL AND "documents"."deleted_by_user_id" IS NULL AND "documents"."delete_reason" IS NULL) OR ("documents"."deleted_at" IS NOT NULL AND "documents"."deleted_by_user_id" IS NOT NULL AND "documents"."delete_reason" IS NOT NULL AND length(trim("documents"."delete_reason")) > 0))
);
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_request_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"relation_type" varchar(32) DEFAULT 'request' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_request_documents_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "transport_request_documents_tenant_request_document_unique" UNIQUE("tenant_id","transport_request_id","document_id"),
	CONSTRAINT "transport_request_documents_relation_check" CHECK ("transport_request_documents"."relation_type" in ('request','commercial','compliance','reference','other'))
);
--> statement-breakpoint
ALTER TABLE "transport_request_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "capacity_asset_documents" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "business_party_documents" ADD CONSTRAINT "business_party_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_documents" ADD CONSTRAINT "business_party_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_documents" ADD CONSTRAINT "business_party_documents_party_fk" FOREIGN KEY ("tenant_id","business_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_party_documents" ADD CONSTRAINT "business_party_documents_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_validations" ADD CONSTRAINT "document_validations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_validations" ADD CONSTRAINT "document_validations_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_validations" ADD CONSTRAINT "document_validations_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_validations" ADD CONSTRAINT "document_validations_version_fk" FOREIGN KEY ("tenant_id","document_id","document_version_id") REFERENCES "public"."document_versions"("tenant_id","document_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_fk" FOREIGN KEY ("tenant_id","document_type_id") REFERENCES "public"."document_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_documents" ADD CONSTRAINT "transport_request_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_documents" ADD CONSTRAINT "transport_request_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_documents" ADD CONSTRAINT "transport_request_documents_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_documents" ADD CONSTRAINT "transport_request_documents_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_party_documents_tenant_party_idx" ON "business_party_documents" USING btree ("tenant_id","business_party_id");--> statement-breakpoint
CREATE INDEX "document_validations_tenant_document_time_idx" ON "document_validations" USING btree ("tenant_id","document_id","validated_at");--> statement-breakpoint
CREATE INDEX "document_validations_tenant_result_time_idx" ON "document_validations" USING btree ("tenant_id","result","validated_at");--> statement-breakpoint
CREATE INDEX "document_versions_tenant_document_created_idx" ON "document_versions" USING btree ("tenant_id","document_id","created_at");--> statement-breakpoint
CREATE INDEX "documents_tenant_status_created_idx" ON "documents" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "documents_tenant_type_status_idx" ON "documents" USING btree ("tenant_id","document_type_id","status");--> statement-breakpoint
CREATE INDEX "documents_tenant_expiry_idx" ON "documents" USING btree ("tenant_id","expires_on");--> statement-breakpoint
CREATE INDEX "documents_tenant_deleted_idx" ON "documents" USING btree ("tenant_id","deleted_at");--> statement-breakpoint
CREATE INDEX "transport_request_documents_tenant_request_idx" ON "transport_request_documents" USING btree ("tenant_id","transport_request_id");--> statement-breakpoint
ALTER TABLE "capacity_asset_documents" ADD CONSTRAINT "capacity_asset_documents_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capacity_asset_documents_tenant_document_unique" ON "capacity_asset_documents" USING btree ("tenant_id","document_id") WHERE "capacity_asset_documents"."document_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "driver_documents_tenant_document_unique" ON "driver_documents" USING btree ("tenant_id","document_id") WHERE "driver_documents"."document_id" IS NOT NULL;--> statement-breakpoint
CREATE POLICY "business_party_documents_tenant_isolation" ON "business_party_documents" AS PERMISSIVE FOR ALL TO public USING ("business_party_documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("business_party_documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "document_validations_tenant_isolation" ON "document_validations" AS PERMISSIVE FOR ALL TO public USING ("document_validations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("document_validations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "document_versions_tenant_isolation" ON "document_versions" AS PERMISSIVE FOR ALL TO public USING ("document_versions"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("document_versions"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "documents_tenant_isolation" ON "documents" AS PERMISSIVE FOR ALL TO public USING ("documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "transport_request_documents_tenant_isolation" ON "transport_request_documents" AS PERMISSIVE FOR ALL TO public USING ("transport_request_documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("transport_request_documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON TABLE documents TO nexora_app;
GRANT SELECT, INSERT ON TABLE document_versions, document_validations, business_party_documents, transport_request_documents TO nexora_app;
