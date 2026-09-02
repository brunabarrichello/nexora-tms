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
CREATE POLICY "audit_events_worker_insert" ON "audit_events" AS PERMISSIVE FOR INSERT TO nexora_worker WITH CHECK (true);--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "outbox_events", "durable_jobs" TO nexora_app;--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "outbox_events", "durable_jobs" FROM nexora_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "outbox_events", "durable_jobs" TO nexora_worker;--> statement-breakpoint
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "outbox_events", "durable_jobs" FROM nexora_worker;--> statement-breakpoint
GRANT INSERT ON TABLE "audit_events" TO nexora_worker;--> statement-breakpoint

CREATE FUNCTION "nexora_claim_outbox_events"(
  p_worker_id text,
  p_batch_size integer DEFAULT 50,
  p_lease_seconds integer DEFAULT 30
)
RETURNS SETOF outbox_events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF length(trim(coalesce(p_worker_id, ''))) = 0 THEN
    RAISE EXCEPTION 'worker id is required';
  END IF;
  IF p_batch_size < 1 OR p_batch_size > 500 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 500';
  END IF;
  IF p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'lease seconds must be between 1 and 3600';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT id
      FROM outbox_events
     WHERE processed_at IS NULL
       AND dead_lettered_at IS NULL
       AND available_at <= now()
       AND attempts < max_attempts
       AND (lease_expires_at IS NULL OR lease_expires_at <= now())
     ORDER BY available_at, occurred_at, id
     FOR UPDATE SKIP LOCKED
     LIMIT p_batch_size
  )
  UPDATE outbox_events AS event
     SET attempts = event.attempts + 1,
         lease_owner = trim(p_worker_id),
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         updated_at = now()
    FROM candidates
   WHERE event.id = candidates.id
  RETURNING event.*;
END
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_complete_outbox_event"(p_event_id uuid, p_worker_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_event outbox_events%ROWTYPE;
BEGIN
  UPDATE outbox_events
     SET processed_at = now(),
         lease_owner = NULL,
         lease_expires_at = NULL,
         last_error = NULL,
         updated_at = now()
   WHERE id = p_event_id
     AND processed_at IS NULL
     AND dead_lettered_at IS NULL
     AND lease_owner = trim(p_worker_id)
  RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO audit_events (
    tenant_id, action, outcome, source, entity_type, entity_id,
    actor_type, actor_external_id, correlation_id, request_id,
    idempotency_key, metadata
  ) VALUES (
    v_event.tenant_id, 'async.outbox.processed', 'success', 'worker',
    'outbox_event', v_event.id::text, 'service', trim(p_worker_id),
    v_event.correlation_id, v_event.request_id, v_event.idempotency_key,
    jsonb_build_object('attempt', v_event.attempts, 'eventType', v_event.event_type)
  );

  RETURN true;
END
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_fail_outbox_event"(
  p_event_id uuid,
  p_worker_id text,
  p_error text,
  p_base_backoff_seconds integer DEFAULT 5,
  p_max_backoff_seconds integer DEFAULT 900
)
RETURNS varchar
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_event outbox_events%ROWTYPE;
  v_status varchar;
BEGIN
  IF p_base_backoff_seconds < 1 OR p_max_backoff_seconds < p_base_backoff_seconds OR p_max_backoff_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid backoff bounds';
  END IF;

  UPDATE outbox_events AS event
     SET available_at = CASE
           WHEN event.attempts >= event.max_attempts THEN event.available_at
           ELSE now() + make_interval(
             secs => LEAST(
               p_max_backoff_seconds::numeric,
               p_base_backoff_seconds::numeric * power(2::numeric, greatest(event.attempts - 1, 0))
             )::integer
           )
         END,
         dead_lettered_at = CASE WHEN event.attempts >= event.max_attempts THEN now() ELSE NULL END,
         dead_letter_reason = CASE
           WHEN event.attempts >= event.max_attempts THEN left(coalesce(nullif(trim(p_error), ''), 'unspecified worker failure'), 2000)
           ELSE NULL
         END,
         last_error = left(coalesce(nullif(trim(p_error), ''), 'unspecified worker failure'), 4000),
         lease_owner = NULL,
         lease_expires_at = NULL,
         updated_at = now()
   WHERE event.id = p_event_id
     AND event.processed_at IS NULL
     AND event.dead_lettered_at IS NULL
     AND event.lease_owner = trim(p_worker_id)
  RETURNING event.* INTO v_event;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_status := CASE WHEN v_event.dead_lettered_at IS NULL THEN 'retry_wait' ELSE 'dead_lettered' END;

  INSERT INTO audit_events (
    tenant_id, action, outcome, source, entity_type, entity_id,
    actor_type, actor_external_id, correlation_id, request_id,
    idempotency_key, reason, metadata
  ) VALUES (
    v_event.tenant_id,
    CASE WHEN v_status = 'dead_lettered' THEN 'async.outbox.dead_lettered' ELSE 'async.outbox.retry_scheduled' END,
    CASE WHEN v_status = 'dead_lettered' THEN 'failure' ELSE 'partial' END,
    'worker', 'outbox_event', v_event.id::text, 'service', trim(p_worker_id),
    v_event.correlation_id, v_event.request_id, v_event.idempotency_key,
    left(coalesce(nullif(trim(p_error), ''), 'unspecified worker failure'), 1500),
    jsonb_build_object('attempt', v_event.attempts, 'maxAttempts', v_event.max_attempts, 'status', v_status)
  );

  RETURN v_status;
END
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_claim_durable_jobs"(
  p_worker_id text,
  p_batch_size integer DEFAULT 50,
  p_lease_seconds integer DEFAULT 30
)
RETURNS SETOF durable_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF length(trim(coalesce(p_worker_id, ''))) = 0 THEN
    RAISE EXCEPTION 'worker id is required';
  END IF;
  IF p_batch_size < 1 OR p_batch_size > 500 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 500';
  END IF;
  IF p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'lease seconds must be between 1 and 3600';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT id
      FROM durable_jobs
     WHERE attempt < max_attempts
       AND (
         (status IN ('pending', 'retry_wait') AND run_at <= now())
         OR (status = 'running' AND lease_expires_at <= now())
       )
     ORDER BY run_at, created_at, id
     FOR UPDATE SKIP LOCKED
     LIMIT p_batch_size
  )
  UPDATE durable_jobs AS job
     SET status = 'running',
         attempt = job.attempt + 1,
         locked_at = now(),
         locked_by = trim(p_worker_id),
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         updated_at = now()
    FROM candidates
   WHERE job.id = candidates.id
  RETURNING job.*;
END
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_complete_durable_job"(p_job_id uuid, p_worker_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_job durable_jobs%ROWTYPE;
BEGIN
  UPDATE durable_jobs
     SET status = 'succeeded',
         locked_at = NULL,
         locked_by = NULL,
         lease_expires_at = NULL,
         last_error = NULL,
         finished_at = now(),
         updated_at = now()
   WHERE id = p_job_id
     AND status = 'running'
     AND locked_by = trim(p_worker_id)
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO audit_events (
    tenant_id, action, outcome, source, entity_type, entity_id,
    actor_type, actor_external_id, correlation_id, request_id,
    idempotency_key, metadata
  ) VALUES (
    v_job.tenant_id, 'async.job.succeeded', 'success', 'worker',
    'durable_job', v_job.id::text, 'service', trim(p_worker_id),
    v_job.correlation_id, v_job.request_id, v_job.idempotency_key,
    jsonb_build_object('attempt', v_job.attempt, 'jobType', v_job.job_type)
  );

  RETURN true;
END
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_fail_durable_job"(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_base_backoff_seconds integer DEFAULT 5,
  p_max_backoff_seconds integer DEFAULT 900
)
RETURNS varchar
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_job durable_jobs%ROWTYPE;
  v_status varchar;
BEGIN
  IF p_base_backoff_seconds < 1 OR p_max_backoff_seconds < p_base_backoff_seconds OR p_max_backoff_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid backoff bounds';
  END IF;

  UPDATE durable_jobs AS job
     SET status = CASE WHEN job.attempt >= job.max_attempts THEN 'dead_lettered' ELSE 'retry_wait' END,
         run_at = CASE
           WHEN job.attempt >= job.max_attempts THEN job.run_at
           ELSE now() + make_interval(
             secs => LEAST(
               p_max_backoff_seconds::numeric,
               p_base_backoff_seconds::numeric * power(2::numeric, greatest(job.attempt - 1, 0))
             )::integer
           )
         END,
         locked_at = NULL,
         locked_by = NULL,
         lease_expires_at = NULL,
         last_error = left(coalesce(nullif(trim(p_error), ''), 'unspecified worker failure'), 4000),
         finished_at = CASE WHEN job.attempt >= job.max_attempts THEN now() ELSE NULL END,
         updated_at = now()
   WHERE job.id = p_job_id
     AND job.status = 'running'
     AND job.locked_by = trim(p_worker_id)
  RETURNING job.* INTO v_job;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_status := v_job.status;

  INSERT INTO audit_events (
    tenant_id, action, outcome, source, entity_type, entity_id,
    actor_type, actor_external_id, correlation_id, request_id,
    idempotency_key, reason, metadata
  ) VALUES (
    v_job.tenant_id,
    CASE WHEN v_status = 'dead_lettered' THEN 'async.job.dead_lettered' ELSE 'async.job.retry_scheduled' END,
    CASE WHEN v_status = 'dead_lettered' THEN 'failure' ELSE 'partial' END,
    'worker', 'durable_job', v_job.id::text, 'service', trim(p_worker_id),
    v_job.correlation_id, v_job.request_id, v_job.idempotency_key,
    left(coalesce(nullif(trim(p_error), ''), 'unspecified worker failure'), 1500),
    jsonb_build_object('attempt', v_job.attempt, 'maxAttempts', v_job.max_attempts, 'status', v_status, 'jobType', v_job.job_type)
  );

  RETURN v_status;
END
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_requeue_dead_lettered_outbox_event"(
  p_event_id uuid,
  p_available_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_event outbox_events%ROWTYPE;
BEGIN
  UPDATE outbox_events
     SET attempts = 0,
         available_at = coalesce(p_available_at, now()),
         lease_owner = NULL,
         lease_expires_at = NULL,
         last_error = NULL,
         dead_lettered_at = NULL,
         dead_letter_reason = NULL,
         updated_at = now()
   WHERE id = p_event_id
     AND processed_at IS NULL
     AND dead_lettered_at IS NOT NULL
  RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO audit_events (
    tenant_id, action, outcome, source, entity_type, entity_id,
    actor_type, correlation_id, request_id, idempotency_key, metadata
  ) VALUES (
    v_event.tenant_id, 'async.outbox.requeued', 'success', 'admin',
    'outbox_event', v_event.id::text, 'system', v_event.correlation_id,
    v_event.request_id, v_event.idempotency_key,
    jsonb_build_object('eventType', v_event.event_type)
  );

  RETURN true;
END
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_requeue_dead_lettered_job"(
  p_job_id uuid,
  p_run_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_job durable_jobs%ROWTYPE;
BEGIN
  UPDATE durable_jobs
     SET status = 'retry_wait',
         attempt = 0,
         run_at = coalesce(p_run_at, now()),
         locked_at = NULL,
         locked_by = NULL,
         lease_expires_at = NULL,
         last_error = NULL,
         finished_at = NULL,
         updated_at = now()
   WHERE id = p_job_id
     AND status = 'dead_lettered'
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO audit_events (
    tenant_id, action, outcome, source, entity_type, entity_id,
    actor_type, correlation_id, request_id, idempotency_key, metadata
  ) VALUES (
    v_job.tenant_id, 'async.job.requeued', 'success', 'admin',
    'durable_job', v_job.id::text, 'system', v_job.correlation_id,
    v_job.request_id, v_job.idempotency_key,
    jsonb_build_object('jobType', v_job.job_type)
  );

  RETURN true;
END
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION "nexora_claim_outbox_events"(text, integer, integer) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_complete_outbox_event"(uuid, text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_fail_outbox_event"(uuid, text, text, integer, integer) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_claim_durable_jobs"(text, integer, integer) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_complete_durable_job"(uuid, text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_fail_durable_job"(uuid, text, text, integer, integer) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_requeue_dead_lettered_outbox_event"(uuid, timestamptz) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_requeue_dead_lettered_job"(uuid, timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_claim_outbox_events"(text, integer, integer) TO nexora_worker;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_complete_outbox_event"(uuid, text) TO nexora_worker;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_fail_outbox_event"(uuid, text, text, integer, integer) TO nexora_worker;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_claim_durable_jobs"(text, integer, integer) TO nexora_worker;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_complete_durable_job"(uuid, text) TO nexora_worker;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_fail_durable_job"(uuid, text, text, integer, integer) TO nexora_worker;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_requeue_dead_lettered_outbox_event"(uuid, timestamptz) TO nexora_owner;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_requeue_dead_lettered_job"(uuid, timestamptz) TO nexora_owner;