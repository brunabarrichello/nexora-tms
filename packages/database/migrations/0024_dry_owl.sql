CREATE TABLE "audit_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"audit_event_id" uuid NOT NULL,
	"field_path" varchar(300) NOT NULL,
	"operation" varchar(24) NOT NULL,
	"before_value" jsonb,
	"after_value" jsonb,
	"sensitive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_changes_field_path_check" CHECK (length(trim("audit_changes"."field_path")) > 0),
	CONSTRAINT "audit_changes_operation_check" CHECK ("audit_changes"."operation" in ('set','unset','add','remove','replace')),
	CONSTRAINT "audit_changes_sensitive_payload_check" CHECK (NOT "audit_changes"."sensitive" OR ("audit_changes"."before_value" IS NULL AND "audit_changes"."after_value" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "audit_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" varchar(120) NOT NULL,
	"outcome" varchar(24) DEFAULT 'success' NOT NULL,
	"source" varchar(32) DEFAULT 'api' NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(160),
	"actor_type" varchar(24) DEFAULT 'user' NOT NULL,
	"actor_user_id" uuid,
	"actor_external_id" varchar(240),
	"correlation_id" varchar(120),
	"request_id" varchar(120),
	"idempotency_key" varchar(180),
	"ip_address" varchar(45),
	"user_agent" varchar(1000),
	"reason" varchar(1500),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "audit_events_action_check" CHECK (length(trim("audit_events"."action")) > 0),
	CONSTRAINT "audit_events_entity_type_check" CHECK (length(trim("audit_events"."entity_type")) > 0),
	CONSTRAINT "audit_events_outcome_check" CHECK ("audit_events"."outcome" in ('success','failure','denied','partial')),
	CONSTRAINT "audit_events_source_check" CHECK ("audit_events"."source" in ('api','worker','system','integration','migration','admin')),
	CONSTRAINT "audit_events_actor_type_check" CHECK ("audit_events"."actor_type" in ('user','service','system','integration','anonymous')),
	CONSTRAINT "audit_events_user_actor_check" CHECK ("audit_events"."actor_type" <> 'user' OR "audit_events"."actor_user_id" IS NOT NULL),
	CONSTRAINT "audit_events_non_user_actor_check" CHECK ("audit_events"."actor_type" = 'user' OR "audit_events"."actor_external_id" IS NOT NULL OR "audit_events"."actor_type" in ('system','anonymous'))
);
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_changes" ADD CONSTRAINT "audit_changes_event_fk" FOREIGN KEY ("tenant_id","audit_event_id") REFERENCES "public"."audit_events"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_changes_tenant_event_idx" ON "audit_changes" USING btree ("tenant_id","audit_event_id");--> statement-breakpoint
CREATE INDEX "audit_changes_tenant_field_idx" ON "audit_changes" USING btree ("tenant_id","field_path");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_occurred_idx" ON "audit_events" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_entity_idx" ON "audit_events" USING btree ("tenant_id","entity_type","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_actor_idx" ON "audit_events" USING btree ("tenant_id","actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_action_idx" ON "audit_events" USING btree ("tenant_id","action","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_correlation_idx" ON "audit_events" USING btree ("tenant_id","correlation_id");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_request_idx" ON "audit_events" USING btree ("tenant_id","request_id");--> statement-breakpoint
CREATE POLICY "audit_changes_tenant_isolation" ON "audit_changes" AS PERMISSIVE FOR ALL TO public USING ("audit_changes"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("audit_changes"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "audit_events_tenant_isolation" ON "audit_events" AS PERMISSIVE FOR ALL TO public USING ("audit_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("audit_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);