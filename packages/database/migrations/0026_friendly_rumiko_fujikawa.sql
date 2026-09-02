CREATE TABLE "durable_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_outbox_event_id" uuid,
	"job_type" varchar(160) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"idempotency_key" varchar(180) NOT NULL,
	"correlation_id" varchar(120),
	"request_id" varchar(120),
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" varchar(160),
	"lease_expires_at" timestamp with time zone,
	"last_error" varchar(4000),
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "durable_jobs_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "durable_jobs_tenant_idempotency_unique" UNIQUE("tenant_id","idempotency_key"),
	CONSTRAINT "durable_jobs_job_type_check" CHECK (length(trim("durable_jobs"."job_type")) > 0),
	CONSTRAINT "durable_jobs_status_check" CHECK ("durable_jobs"."status" in ('pending','running','retry_wait','succeeded','dead_lettered','cancelled')),
	CONSTRAINT "durable_jobs_attempt_check" CHECK ("durable_jobs"."attempt" >= 0),
	CONSTRAINT "durable_jobs_max_attempts_check" CHECK ("durable_jobs"."max_attempts" > 0),
	CONSTRAINT "durable_jobs_attempt_limit_check" CHECK ("durable_jobs"."attempt" <= "durable_jobs"."max_attempts"),
	CONSTRAINT "durable_jobs_lock_pair_check" CHECK (("durable_jobs"."locked_at" IS NULL AND "durable_jobs"."locked_by" IS NULL AND "durable_jobs"."lease_expires_at" IS NULL) OR ("durable_jobs"."locked_at" IS NOT NULL AND "durable_jobs"."locked_by" IS NOT NULL AND "durable_jobs"."lease_expires_at" IS NOT NULL)),
	CONSTRAINT "durable_jobs_running_lock_check" CHECK ("durable_jobs"."status" <> 'running' OR ("durable_jobs"."locked_at" IS NOT NULL AND "durable_jobs"."locked_by" IS NOT NULL AND "durable_jobs"."lease_expires_at" IS NOT NULL)),
	CONSTRAINT "durable_jobs_finished_at_check" CHECK ("durable_jobs"."status" NOT IN ('succeeded','dead_lettered','cancelled') OR "durable_jobs"."finished_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "durable_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"aggregate_type" varchar(100) NOT NULL,
	"aggregate_id" varchar(160) NOT NULL,
	"event_type" varchar(160) NOT NULL,
	"event_version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" varchar(180) NOT NULL,
	"correlation_id" varchar(120),
	"request_id" varchar(120),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 10 NOT NULL,
	"lease_owner" varchar(160),
	"lease_expires_at" timestamp with time zone,
	"last_error" varchar(4000),
	"dead_lettered_at" timestamp with time zone,
	"dead_letter_reason" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "outbox_events_tenant_idempotency_unique" UNIQUE("tenant_id","idempotency_key"),
	CONSTRAINT "outbox_events_aggregate_type_check" CHECK (length(trim("outbox_events"."aggregate_type")) > 0),
	CONSTRAINT "outbox_events_aggregate_id_check" CHECK (length(trim("outbox_events"."aggregate_id")) > 0),
	CONSTRAINT "outbox_events_event_type_check" CHECK (length(trim("outbox_events"."event_type")) > 0),
	CONSTRAINT "outbox_events_event_version_check" CHECK ("outbox_events"."event_version" > 0),
	CONSTRAINT "outbox_events_attempts_check" CHECK ("outbox_events"."attempts" >= 0),
	CONSTRAINT "outbox_events_max_attempts_check" CHECK ("outbox_events"."max_attempts" > 0),
	CONSTRAINT "outbox_events_attempt_limit_check" CHECK ("outbox_events"."attempts" <= "outbox_events"."max_attempts"),
	CONSTRAINT "outbox_events_terminal_state_check" CHECK (NOT ("outbox_events"."processed_at" IS NOT NULL AND "outbox_events"."dead_lettered_at" IS NOT NULL)),
	CONSTRAINT "outbox_events_lease_pair_check" CHECK (("outbox_events"."lease_owner" IS NULL) = ("outbox_events"."lease_expires_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "durable_jobs" ADD CONSTRAINT "durable_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "durable_jobs" ADD CONSTRAINT "durable_jobs_source_outbox_fk" FOREIGN KEY ("tenant_id","source_outbox_event_id") REFERENCES "public"."outbox_events"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "durable_jobs_tenant_status_run_idx" ON "durable_jobs" USING btree ("tenant_id","status","run_at");--> statement-breakpoint
CREATE INDEX "durable_jobs_runnable_idx" ON "durable_jobs" USING btree ("run_at","created_at") WHERE "durable_jobs"."status" in ('pending','retry_wait');--> statement-breakpoint
CREATE INDEX "durable_jobs_lease_idx" ON "durable_jobs" USING btree ("lease_expires_at") WHERE "durable_jobs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "durable_jobs_tenant_correlation_idx" ON "durable_jobs" USING btree ("tenant_id","correlation_id");--> statement-breakpoint
CREATE INDEX "outbox_events_tenant_available_idx" ON "outbox_events" USING btree ("tenant_id","available_at");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" USING btree ("available_at","occurred_at") WHERE "outbox_events"."processed_at" IS NULL AND "outbox_events"."dead_lettered_at" IS NULL;--> statement-breakpoint
CREATE INDEX "outbox_events_lease_idx" ON "outbox_events" USING btree ("lease_expires_at") WHERE "outbox_events"."processed_at" IS NULL AND "outbox_events"."dead_lettered_at" IS NULL;--> statement-breakpoint
CREATE INDEX "outbox_events_tenant_correlation_idx" ON "outbox_events" USING btree ("tenant_id","correlation_id");--> statement-breakpoint
CREATE POLICY "durable_jobs_tenant_isolation" ON "durable_jobs" AS PERMISSIVE FOR ALL TO public USING ("durable_jobs"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("durable_jobs"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "outbox_events_tenant_isolation" ON "outbox_events" AS PERMISSIVE FOR ALL TO public USING ("outbox_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("outbox_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "durable_jobs_worker_cross_tenant" ON "durable_jobs" AS PERMISSIVE FOR ALL TO nexora_worker USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "outbox_events_worker_cross_tenant" ON "outbox_events" AS PERMISSIVE FOR ALL TO nexora_worker USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "outbox_events", "durable_jobs" TO nexora_app;--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "outbox_events", "durable_jobs" FROM nexora_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "outbox_events", "durable_jobs" TO nexora_worker;--> statement-breakpoint
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "outbox_events", "durable_jobs" FROM nexora_worker;