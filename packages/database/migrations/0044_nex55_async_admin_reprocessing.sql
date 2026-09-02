CREATE FUNCTION "nexora_assert_async_admin"()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_authorized boolean;
BEGIN
  v_tenant_id := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_user_id := nullif(current_setting('app.user_id', true), '')::uuid;

  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'tenant and user context are required for async administration'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM memberships m
      JOIN users u
        ON u.id = m.user_id
      JOIN membership_roles mr
        ON mr.tenant_id = m.tenant_id
       AND mr.membership_id = m.id
      JOIN roles r
        ON r.tenant_id = mr.tenant_id
       AND r.id = mr.role_id
     WHERE m.tenant_id = v_tenant_id
       AND m.user_id = v_user_id
       AND m.status = 'active'
       AND u.status = 'active'
       AND r.code = 'tenant_admin'
  ) INTO v_authorized;

  IF NOT coalesce(v_authorized, false) THEN
    RAISE EXCEPTION 'tenant admin membership is required for async reprocessing'
      USING ERRCODE = '42501';
  END IF;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_admin_requeue_outbox_event"(
  p_event_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_event outbox_events%ROWTYPE;
  v_requeued boolean;
  v_reason text;
BEGIN
  PERFORM nexora_assert_async_admin();

  v_tenant_id := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_user_id := nullif(current_setting('app.user_id', true), '')::uuid;
  v_reason := trim(coalesce(p_reason, ''));

  IF length(v_reason) < 3 OR length(v_reason) > 500 THEN
    RAISE EXCEPTION 'reprocessing reason must contain between 3 and 500 characters'
      USING ERRCODE = '22023';
  END IF;

  SELECT event.*
    INTO v_event
    FROM outbox_events event
   WHERE event.id = p_event_id
     AND event.tenant_id = v_tenant_id
     AND event.processed_at IS NULL
     AND event.dead_lettered_at IS NOT NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT nexora_requeue_dead_lettered_outbox_event(v_event.id, now())
    INTO v_requeued;

  IF NOT coalesce(v_requeued, false) THEN
    RETURN false;
  END IF;

  INSERT INTO audit_events (
    tenant_id, action, outcome, source, entity_type, entity_id,
    actor_type, actor_user_id, correlation_id, request_id,
    idempotency_key, reason, metadata
  ) VALUES (
    v_event.tenant_id,
    'async.outbox.reprocess_requested',
    'success',
    'api',
    'outbox_event',
    v_event.id::text,
    'user',
    v_user_id,
    v_event.correlation_id,
    v_event.request_id,
    v_event.idempotency_key,
    left(v_reason, 500),
    jsonb_build_object(
      'eventType', v_event.event_type,
      'aggregateType', v_event.aggregate_type,
      'aggregateId', v_event.aggregate_id,
      'previousAttempts', v_event.attempts
    )
  );

  RETURN true;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_admin_requeue_durable_job"(
  p_job_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_job durable_jobs%ROWTYPE;
  v_requeued boolean;
  v_reason text;
BEGIN
  PERFORM nexora_assert_async_admin();

  v_tenant_id := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_user_id := nullif(current_setting('app.user_id', true), '')::uuid;
  v_reason := trim(coalesce(p_reason, ''));

  IF length(v_reason) < 3 OR length(v_reason) > 500 THEN
    RAISE EXCEPTION 'reprocessing reason must contain between 3 and 500 characters'
      USING ERRCODE = '22023';
  END IF;

  SELECT job.*
    INTO v_job
    FROM durable_jobs job
   WHERE job.id = p_job_id
     AND job.tenant_id = v_tenant_id
     AND job.status = 'dead_lettered'
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT nexora_requeue_dead_lettered_job(v_job.id, now())
    INTO v_requeued;

  IF NOT coalesce(v_requeued, false) THEN
    RETURN false;
  END IF;

  INSERT INTO audit_events (
    tenant_id, action, outcome, source, entity_type, entity_id,
    actor_type, actor_user_id, correlation_id, request_id,
    idempotency_key, reason, metadata
  ) VALUES (
    v_job.tenant_id,
    'async.job.reprocess_requested',
    'success',
    'api',
    'durable_job',
    v_job.id::text,
    'user',
    v_user_id,
    v_job.correlation_id,
    v_job.request_id,
    v_job.idempotency_key,
    left(v_reason, 500),
    jsonb_build_object(
      'jobType', v_job.job_type,
      'previousAttempt', v_job.attempt
    )
  );

  RETURN true;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION "nexora_assert_async_admin"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_admin_requeue_outbox_event"(uuid, text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_admin_requeue_durable_job"(uuid, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_admin_requeue_outbox_event"(uuid, text) TO nexora_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_admin_requeue_durable_job"(uuid, text) TO nexora_app;