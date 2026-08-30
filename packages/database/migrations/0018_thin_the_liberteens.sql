CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"target_kind" varchar(32) NOT NULL,
	"relation_type" varchar(64) DEFAULT 'attachment' NOT NULL,
	"party_id" uuid,
	"driver_id" uuid,
	"driver_document_id" uuid,
	"asset_id" uuid,
	"asset_document_id" uuid,
	"transport_request_id" uuid,
	"transport_contract_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unlinked_at" timestamp with time zone,
	"unlinked_by_user_id" uuid,
	"unlink_reason" varchar(1000),
	CONSTRAINT "document_links_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "document_links_target_kind_check" CHECK ("document_links"."target_kind" in ('party','driver','driver_document','asset','asset_document','request','contract')),
	CONSTRAINT "document_links_relation_check" CHECK (length(trim("document_links"."relation_type")) > 0),
	CONSTRAINT "document_links_exactly_one_target_check" CHECK ((
        ("document_links"."party_id" IS NOT NULL)::int +
        ("document_links"."driver_id" IS NOT NULL)::int +
        ("document_links"."driver_document_id" IS NOT NULL)::int +
        ("document_links"."asset_id" IS NOT NULL)::int +
        ("document_links"."asset_document_id" IS NOT NULL)::int +
        ("document_links"."transport_request_id" IS NOT NULL)::int +
        ("document_links"."transport_contract_id" IS NOT NULL)::int
      ) = 1),
	CONSTRAINT "document_links_kind_target_check" CHECK ((
        ("document_links"."target_kind" = 'party' AND "document_links"."party_id" IS NOT NULL) OR
        ("document_links"."target_kind" = 'driver' AND "document_links"."driver_id" IS NOT NULL) OR
        ("document_links"."target_kind" = 'driver_document' AND "document_links"."driver_document_id" IS NOT NULL) OR
        ("document_links"."target_kind" = 'asset' AND "document_links"."asset_id" IS NOT NULL) OR
        ("document_links"."target_kind" = 'asset_document' AND "document_links"."asset_document_id" IS NOT NULL) OR
        ("document_links"."target_kind" = 'request' AND "document_links"."transport_request_id" IS NOT NULL) OR
        ("document_links"."target_kind" = 'contract' AND "document_links"."transport_contract_id" IS NOT NULL)
      )),
	CONSTRAINT "document_links_unlink_check" CHECK (("document_links"."unlinked_at" IS NULL AND "document_links"."unlinked_by_user_id" IS NULL AND "document_links"."unlink_reason" IS NULL) OR ("document_links"."unlinked_at" IS NOT NULL AND "document_links"."unlinked_by_user_id" IS NOT NULL AND length(trim(coalesce("document_links"."unlink_reason", ''))) > 0))
);
--> statement-breakpoint
ALTER TABLE "document_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version_id" uuid,
	"validation_type" varchar(32) NOT NULL,
	"status" varchar(24) NOT NULL,
	"validator_user_id" uuid,
	"validated_at" timestamp with time zone,
	"provider" varchar(120),
	"rule_code" varchar(120),
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" varchar(1500),
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_validations_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "document_validations_type_check" CHECK ("document_validations"."validation_type" in ('manual','automated','antifraud','compliance','other')),
	CONSTRAINT "document_validations_status_check" CHECK ("document_validations"."status" in ('pending','validated','rejected','warning','not_applicable')),
	CONSTRAINT "document_validations_completion_check" CHECK (("document_validations"."status" = 'pending' AND "document_validations"."validated_at" IS NULL) OR ("document_validations"."status" <> 'pending' AND "document_validations"."validated_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "document_validations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"storage_provider" varchar(32) NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(160) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"source" varchar(32) DEFAULT 'upload' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_tenant_document_id_unique" UNIQUE("tenant_id","document_id","id"),
	CONSTRAINT "document_versions_tenant_document_version_unique" UNIQUE("tenant_id","document_id","version_number"),
	CONSTRAINT "document_versions_tenant_storage_unique" UNIQUE("tenant_id","storage_provider","storage_key"),
	CONSTRAINT "document_versions_number_check" CHECK ("document_versions"."version_number" > 0),
	CONSTRAINT "document_versions_storage_key_check" CHECK (length(trim("document_versions"."storage_key")) > 0),
	CONSTRAINT "document_versions_file_name_check" CHECK (length(trim("document_versions"."file_name")) > 0),
	CONSTRAINT "document_versions_mime_type_check" CHECK (length(trim("document_versions"."mime_type")) > 0),
	CONSTRAINT "document_versions_size_check" CHECK ("document_versions"."size_bytes" > 0),
	CONSTRAINT "document_versions_sha256_check" CHECK ("document_versions"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "document_versions_provider_check" CHECK ("document_versions"."storage_provider" in ('s3','gcs','azure','local','external','other')),
	CONSTRAINT "document_versions_source_check" CHECK ("document_versions"."source" in ('upload','integration','migration','generated'))
);
--> statement-breakpoint
ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"title" varchar(240) NOT NULL,
	"document_number" varchar(120),
	"issuer" varchar(180),
	"issued_on" date,
	"expires_on" date,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"validation_status" varchar(24) DEFAULT 'pending' NOT NULL,
	"current_version_number" integer DEFAULT 0 NOT NULL,
	"is_blocking" boolean DEFAULT false NOT NULL,
	"notes" varchar(1500),
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "documents_title_check" CHECK (length(trim("documents"."title")) > 0),
	CONSTRAINT "documents_dates_check" CHECK ("documents"."issued_on" IS NULL OR "documents"."expires_on" IS NULL OR "documents"."expires_on" >= "documents"."issued_on"),
	CONSTRAINT "documents_status_check" CHECK ("documents"."status" in ('draft','active','expired','blocked','archived')),
	CONSTRAINT "documents_validation_status_check" CHECK ("documents"."validation_status" in ('pending','validated','rejected','not_required')),
	CONSTRAINT "documents_version_check" CHECK ("documents"."current_version_number" >= 0)
);
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_types" DROP CONSTRAINT "document_types_subject_scope_check";--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_unlinked_by_user_id_users_id_fk" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_party_fk" FOREIGN KEY ("tenant_id","party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_driver_document_fk" FOREIGN KEY ("tenant_id","driver_document_id") REFERENCES "public"."driver_documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_asset_fk" FOREIGN KEY ("tenant_id","asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_asset_document_fk" FOREIGN KEY ("tenant_id","asset_document_id") REFERENCES "public"."capacity_asset_documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_contract_fk" FOREIGN KEY ("tenant_id","transport_contract_id") REFERENCES "public"."transport_contracts"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_validations" ADD CONSTRAINT "document_validations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_validations" ADD CONSTRAINT "document_validations_validator_user_id_users_id_fk" FOREIGN KEY ("validator_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_validations" ADD CONSTRAINT "document_validations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_validations" ADD CONSTRAINT "document_validations_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_validations" ADD CONSTRAINT "document_validations_version_fk" FOREIGN KEY ("tenant_id","document_id","version_id") REFERENCES "public"."document_versions"("tenant_id","document_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_fk" FOREIGN KEY ("tenant_id","document_type_id") REFERENCES "public"."document_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_links_active_party_unique" ON "document_links" USING btree ("tenant_id","document_id","party_id","relation_type") WHERE "document_links"."party_id" IS NOT NULL AND "document_links"."unlinked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_links_active_driver_unique" ON "document_links" USING btree ("tenant_id","document_id","driver_id","relation_type") WHERE "document_links"."driver_id" IS NOT NULL AND "document_links"."unlinked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_links_active_driver_document_unique" ON "document_links" USING btree ("tenant_id","document_id","driver_document_id","relation_type") WHERE "document_links"."driver_document_id" IS NOT NULL AND "document_links"."unlinked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_links_active_asset_unique" ON "document_links" USING btree ("tenant_id","document_id","asset_id","relation_type") WHERE "document_links"."asset_id" IS NOT NULL AND "document_links"."unlinked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_links_active_asset_document_unique" ON "document_links" USING btree ("tenant_id","document_id","asset_document_id","relation_type") WHERE "document_links"."asset_document_id" IS NOT NULL AND "document_links"."unlinked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_links_active_request_unique" ON "document_links" USING btree ("tenant_id","document_id","transport_request_id","relation_type") WHERE "document_links"."transport_request_id" IS NOT NULL AND "document_links"."unlinked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "document_links_active_contract_unique" ON "document_links" USING btree ("tenant_id","document_id","transport_contract_id","relation_type") WHERE "document_links"."transport_contract_id" IS NOT NULL AND "document_links"."unlinked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "document_links_tenant_document_active_idx" ON "document_links" USING btree ("tenant_id","document_id","unlinked_at");--> statement-breakpoint
CREATE INDEX "document_validations_tenant_document_created_idx" ON "document_validations" USING btree ("tenant_id","document_id","created_at");--> statement-breakpoint
CREATE INDEX "document_validations_tenant_status_idx" ON "document_validations" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "document_versions_tenant_document_created_idx" ON "document_versions" USING btree ("tenant_id","document_id","created_at");--> statement-breakpoint
CREATE INDEX "documents_tenant_status_idx" ON "documents" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "documents_tenant_validation_idx" ON "documents" USING btree ("tenant_id","validation_status");--> statement-breakpoint
CREATE INDEX "documents_tenant_expiry_idx" ON "documents" USING btree ("tenant_id","expires_on");--> statement-breakpoint
CREATE INDEX "documents_tenant_type_idx" ON "documents" USING btree ("tenant_id","document_type_id");--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_subject_scope_check" CHECK ("document_types"."subject_scope" in ('party','driver','asset','request','trip','financial','contract','other'));--> statement-breakpoint
CREATE POLICY "document_links_tenant_isolation" ON "document_links" AS PERMISSIVE FOR ALL TO public USING ("document_links"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("document_links"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "document_validations_tenant_isolation" ON "document_validations" AS PERMISSIVE FOR ALL TO public USING ("document_validations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("document_validations"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "document_versions_tenant_isolation" ON "document_versions" AS PERMISSIVE FOR ALL TO public USING ("document_versions"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("document_versions"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "documents_tenant_isolation" ON "documents" AS PERMISSIVE FOR ALL TO public USING ("documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("documents"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);