\set ON_ERROR_STOP on

BEGIN;

INSERT INTO outbox_events (
  id, tenant_id, aggregate_type, aggregate_id, event_type, payload,
  idempotency_key, correlation_id, request_id, available_at,
  attempts, max_attempts, lease_owner, lease_expires_at
) VALUES
  (
    '79000000-0000-4000-8000-000000000121',
    '79000000-0000-4000-8000-000000000001',
    'trip', 'reaper-final', 'trip.reaper.final', '{"case":"final"}'::jsonb,
    'nex90-reaper-outbox-final', 'corr-reaper-final', 'req-reaper-final',
    now() - interval '5 minutes',
    1, 1, 'crashed-worker-final', now() - interval '1 minute'
  ),
  (
    '79000000-0000-4000-8000-000000000122',
    '79000000-0000-4000-8000-000000000002',
    'trip', 'reaper-retryable', 'trip.reaper.retryable', '{"case":"retryable"}'::jsonb,
    'nex90-reaper-outbox-retryable', 'corr-reaper-retryable', 'req-reaper-retryable',
    now() - interval '5 minutes',
    1, 2, 'crashed-worker-retryable', now() - interval '1 minute'
  );

INSERT INTO durable_jobs (
  id, tenant_id, job_type, payload, status,
  idempotency_key, correlation_id, request_id, run_at,
  attempt, max_attempts, locked_at, locked_by, lease_expires_at
) VALUES
  (
    '79000000-0000-4000-8000-000000000321',
    '79000000-0000-4000-8000-000000000001',
    'trip.reaper.final', '{"case":"final"}'::jsonb, 'running',
    'nex90-reaper-job-final', 'corr-reaper-final', 'req-reaper-final',
    now() - interval '5 minutes',
    1, 1, now() - interval '2 minutes', 'crashed-worker-final', now() - interval '1 minute'
  ),
  (
    '79000000-0000-4000-8000-000000000322',
    '79000000-0000-4000-8000-000000000002',
    'trip.reaper.retryable', '{"case":"retryable"}'::jsonb, 'running',
    'nex90-reaper-job-retryable', 'corr-reaper-retryable', 'req-reaper-retryable',
    now() - interval '5 minutes',
    1, 2, now() - interval '2 minutes', 'crashed-worker-retryable', now() - interval '1 minute'
  );

DO $block$
DECLARE
  v_count integer;
BEGIN
  SELECT nexora_reap_expired_outbox_leases('worker-ci-reaper', 100) INTO v_count;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one exhausted outbox lease to be reaped, got %', v_count;
  END IF;

  SELECT nexora_reap_expired_durable_job_leases('worker-ci-reaper', 100) INTO v_count;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one exhausted durable-job lease to be reaped, got %', v_count;
  END IF;

  SELECT nexora_reap_expired_outbox_leases('worker-ci-reaper', 100) INTO v_count;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Outbox reaper was not idempotent after terminalization, got %', v_count;
  END IF;

  SELECT nexora_reap_expired_durable_job_leases('worker-ci-reaper', 100) INTO v_count;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Durable-job reaper was not idempotent after terminalization, got %', v_count;
  END IF;
END
$block$;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM outbox_events
     WHERE id = '79000000-0000-4000-8000-000000000121'
       AND attempts = max_attempts
       AND processed_at IS NULL
       AND dead_lettered_at IS NOT NULL
       AND dead_letter_reason = 'worker lease expired after final attempt'
       AND lease_owner IS NULL
       AND lease_expires_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Exhausted outbox lease was not terminalized safely';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM outbox_events
     WHERE id = '79000000-0000-4000-8000-000000000122'
       AND attempts < max_attempts
       AND dead_lettered_at IS NULL
       AND lease_owner = 'crashed-worker-retryable'
       AND lease_expires_at <= now()
  ) THEN
    RAISE EXCEPTION 'Retryable expired outbox lease was reaped incorrectly';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM durable_jobs
     WHERE id = '79000000-0000-4000-8000-000000000321'
       AND status = 'dead_lettered'
       AND attempt = max_attempts
       AND finished_at IS NOT NULL
       AND locked_at IS NULL
       AND locked_by IS NULL
       AND lease_expires_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Exhausted durable-job lease was not terminalized safely';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM durable_jobs
     WHERE id = '79000000-0000-4000-8000-000000000322'
       AND status = 'running'
       AND attempt < max_attempts
       AND locked_by = 'crashed-worker-retryable'
       AND lease_expires_at <= now()
  ) THEN
    RAISE EXCEPTION 'Retryable expired durable-job lease was reaped incorrectly';
  END IF;
END
$block$;

COMMIT;
