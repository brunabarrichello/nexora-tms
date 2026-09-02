-- NEX-90 residual reliability: terminalize work whose final-attempt lease expired
-- before the worker could persist success/failure. This prevents exhausted rows
-- from remaining permanently leased/running after a process crash.

CREATE FUNCTION "nexora_reap_expired_outbox_leases"(
  p_worker_id text,
  p_batch_size integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count integer;
BEGIN
  IF length(trim(coalesce(p_worker_id, ''))) = 0 THEN
    RAISE EXCEPTION 'worker id is required';
  END IF;
  IF p_batch_size < 1 OR p_batch_size > 500 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 500';
  END IF;

  WITH candidates AS (
    SELECT id
      FROM outbox_events
     WHERE processed_at IS NULL
       AND dead_lettered_at IS NULL
       AND attempts >= max_attempts
       AND lease_owner IS NOT NULL
       AND lease_expires_at IS NOT NULL
       AND lease_expires_at <= now()
     ORDER BY lease_expires_at, occurred_at, id
     FOR UPDATE SKIP LOCKED
     LIMIT p_batch_size
  ),
  reaped AS (
    UPDATE outbox_events AS event
       SET dead_lettered_at = now(),
           dead_letter_reason = 'worker lease expired after final attempt',
           last_error = coalesce(
             nullif(event.last_error, ''),
             'worker lease expired after final attempt'
           ),
           lease_owner = NULL,
           lease_expires_at = NULL,
           updated_at = now()
      FROM candidates
     WHERE event.id = candidates.id
    RETURNING event.*
  ),
  audited AS (
    INSERT INTO audit_events (
      tenant_id, action, outcome, source, entity_type, entity_id,
      actor_type, actor_external_id, correlation_id, request_id,
      idempotency_key, reason, metadata
    )
    SELECT
      event.tenant_id,
      'async.outbox.lease_expired_dead_lettered',
      'failure',
      'worker',
      'outbox_event',
      event.id::text,
      'service',
      trim(p_worker_id),
      event.correlation_id,
      event.request_id,
      event.idempotency_key,
      'worker lease expired after final attempt',
      jsonb_build_object(
        'attempt', event.attempts,
        'maxAttempts', event.max_attempts,
        'eventType', event.event_type,
        'leaseReaped', true
      )
      FROM reaped AS event
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM audited;

  RETURN v_count;
END
$$;
--> statement-breakpoint

CREATE FUNCTION "nexora_reap_expired_durable_job_leases"(
  p_worker_id text,
  p_batch_size integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count integer;
BEGIN
  IF length(trim(coalesce(p_worker_id, ''))) = 0 THEN
    RAISE EXCEPTION 'worker id is required';
  END IF;
  IF p_batch_size < 1 OR p_batch_size > 500 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 500';
  END IF;

  WITH candidates AS (
    SELECT id
      FROM durable_jobs
     WHERE status = 'running'
       AND attempt >= max_attempts
       AND lease_expires_at IS NOT NULL
       AND lease_expires_at <= now()
     ORDER BY lease_expires_at, created_at, id
     FOR UPDATE SKIP LOCKED
     LIMIT p_batch_size
  ),
  reaped AS (
    UPDATE durable_jobs AS job
       SET status = 'dead_lettered',
           locked_at = NULL,
           locked_by = NULL,
           lease_expires_at = NULL,
           last_error = coalesce(
             nullif(job.last_error, ''),
             'worker lease expired after final attempt'
           ),
           finished_at = now(),
           updated_at = now()
      FROM candidates
     WHERE job.id = candidates.id
    RETURNING job.*
  ),
  audited AS (
    INSERT INTO audit_events (
      tenant_id, action, outcome, source, entity_type, entity_id,
      actor_type, actor_external_id, correlation_id, request_id,
      idempotency_key, reason, metadata
    )
    SELECT
      job.tenant_id,
      'async.job.lease_expired_dead_lettered',
      'failure',
      'worker',
      'durable_job',
      job.id::text,
      'service',
      trim(p_worker_id),
      job.correlation_id,
      job.request_id,
      job.idempotency_key,
      'worker lease expired after final attempt',
      jsonb_build_object(
        'attempt', job.attempt,
        'maxAttempts', job.max_attempts,
        'jobType', job.job_type,
        'leaseReaped', true
      )
      FROM reaped AS job
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM audited;

  RETURN v_count;
END
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION "nexora_reap_expired_outbox_leases"(text, integer) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_reap_expired_durable_job_leases"(text, integer) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_reap_expired_outbox_leases"(text, integer) TO nexora_worker;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_reap_expired_durable_job_leases"(text, integer) TO nexora_worker;
