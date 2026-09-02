\set ON_ERROR_STOP on

BEGIN;

INSERT INTO outbox_events (
  id, tenant_id, aggregate_type, aggregate_id, event_type, payload,
  idempotency_key, correlation_id, request_id, available_at, max_attempts
) VALUES
  (
    '79000000-0000-4000-8000-000000000111',
    '79000000-0000-4000-8000-000000000001',
    'trip', 'worker-a', 'trip.created', '{"tenant":"a"}'::jsonb,
    'nex90-worker-outbox-a', 'corr-worker-a', 'req-worker-a', now() - interval '2 minutes', 3
  ),
  (
    '79000000-0000-4000-8000-000000000112',
    '79000000-0000-4000-8000-000000000002',
    'trip', 'worker-b', 'trip.created', '{"tenant":"b"}'::jsonb,
    'nex90-worker-outbox-b', 'corr-worker-b', 'req-worker-b', now() - interval '1 minute', 1
  );

INSERT INTO durable_jobs (
  id, tenant_id, source_outbox_event_id, job_type, payload,
  idempotency_key, correlation_id, request_id, run_at, max_attempts
) VALUES
  (
    '79000000-0000-4000-8000-000000000311',
    '79000000-0000-4000-8000-000000000001',
    '79000000-0000-4000-8000-000000000111',
    'trip.created.dispatch', '{"tenant":"a"}'::jsonb,
    'nex90-worker-job-a', 'corr-worker-a', 'req-worker-a', now() - interval '2 minutes', 3
  ),
  (
    '79000000-0000-4000-8000-000000000312',
    '79000000-0000-4000-8000-000000000002',
    '79000000-0000-4000-8000-000000000112',
    'trip.created.dispatch', '{"tenant":"b"}'::jsonb,
    'nex90-worker-job-b', 'corr-worker-b', 'req-worker-b', now() - interval '1 minute', 1
  );

DO $block$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
    FROM outbox_events
   WHERE id IN (
     '79000000-0000-4000-8000-000000000111',
     '79000000-0000-4000-8000-000000000112'
   );
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Worker cannot read outbox rows across tenants: %', v_count;
  END IF;

  SELECT count(*) INTO v_count
    FROM durable_jobs
   WHERE id IN (
     '79000000-0000-4000-8000-000000000311',
     '79000000-0000-4000-8000-000000000312'
   );
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Worker cannot read durable jobs across tenants: %', v_count;
  END IF;
END
$block$;

DO $block$
DECLARE
  v_count integer;
  v_ok boolean;
  v_status text;
BEGIN
  SELECT count(*) INTO v_count
    FROM nexora_claim_outbox_events('worker-ci-1', 1, 30);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Worker 1 expected one claimed outbox event, got %', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM outbox_events
     WHERE id = '79000000-0000-4000-8000-000000000111'
       AND attempts = 1
       AND lease_owner = 'worker-ci-1'
       AND lease_expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Oldest outbox event was not atomically leased by worker 1';
  END IF;

  SELECT count(*) INTO v_count
    FROM nexora_claim_outbox_events('worker-ci-2', 10, 30);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Worker 2 expected only the unleased outbox event, got %', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM outbox_events
     WHERE id = '79000000-0000-4000-8000-000000000112'
       AND attempts = 1
       AND lease_owner = 'worker-ci-2'
  ) THEN
    RAISE EXCEPTION 'Worker 2 did not claim the second outbox event';
  END IF;

  SELECT nexora_complete_outbox_event(
    '79000000-0000-4000-8000-000000000111',
    'worker-ci-2'
  ) INTO v_ok;
  IF v_ok THEN
    RAISE EXCEPTION 'Wrong worker completed another worker outbox lease';
  END IF;

  SELECT nexora_complete_outbox_event(
    '79000000-0000-4000-8000-000000000111',
    'worker-ci-1'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Correct worker could not complete its outbox event';
  END IF;

  SELECT nexora_complete_outbox_event(
    '79000000-0000-4000-8000-000000000111',
    'worker-ci-1'
  ) INTO v_ok;
  IF v_ok THEN
    RAISE EXCEPTION 'Completed outbox event was processed twice';
  END IF;

  SELECT nexora_fail_outbox_event(
    '79000000-0000-4000-8000-000000000112',
    'worker-ci-2',
    'synthetic final outbox failure',
    5,
    60
  ) INTO v_status;
  IF v_status <> 'dead_lettered' THEN
    RAISE EXCEPTION 'Expected dead_lettered outbox status, got %', v_status;
  END IF;
END
$block$;

DO $block$
DECLARE
  v_count integer;
  v_ok boolean;
  v_status text;
  v_run_at timestamptz;
BEGIN
  SELECT count(*) INTO v_count
    FROM nexora_claim_durable_jobs('worker-ci-1', 1, 30);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Worker 1 expected one claimed durable job, got %', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM durable_jobs
     WHERE id = '79000000-0000-4000-8000-000000000311'
       AND status = 'running'
       AND attempt = 1
       AND locked_by = 'worker-ci-1'
       AND lease_expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Oldest durable job was not atomically leased by worker 1';
  END IF;

  SELECT count(*) INTO v_count
    FROM nexora_claim_durable_jobs('worker-ci-2', 10, 30);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Worker 2 expected only the unleased durable job, got %', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM durable_jobs
     WHERE id = '79000000-0000-4000-8000-000000000312'
       AND status = 'running'
       AND attempt = 1
       AND locked_by = 'worker-ci-2'
  ) THEN
    RAISE EXCEPTION 'Worker 2 did not claim the second durable job';
  END IF;

  SELECT nexora_complete_durable_job(
    '79000000-0000-4000-8000-000000000311',
    'worker-ci-2'
  ) INTO v_ok;
  IF v_ok THEN
    RAISE EXCEPTION 'Wrong worker completed another worker durable-job lease';
  END IF;

  SELECT nexora_fail_durable_job(
    '79000000-0000-4000-8000-000000000311',
    'worker-ci-1',
    'synthetic retryable failure',
    5,
    60
  ) INTO v_status;
  IF v_status <> 'retry_wait' THEN
    RAISE EXCEPTION 'Expected retry_wait durable job, got %', v_status;
  END IF;

  SELECT run_at INTO v_run_at
    FROM durable_jobs
   WHERE id = '79000000-0000-4000-8000-000000000311';
  IF v_run_at <= now() THEN
    RAISE EXCEPTION 'Retry backoff did not move run_at into the future';
  END IF;

  SELECT nexora_fail_durable_job(
    '79000000-0000-4000-8000-000000000312',
    'worker-ci-2',
    'synthetic terminal failure',
    5,
    60
  ) INTO v_status;
  IF v_status <> 'dead_lettered' THEN
    RAISE EXCEPTION 'Expected dead_lettered durable job, got %', v_status;
  END IF;

  UPDATE durable_jobs
     SET run_at = now() - interval '1 second',
         updated_at = now()
   WHERE id = '79000000-0000-4000-8000-000000000311'
     AND status = 'retry_wait';

  SELECT count(*) INTO v_count
    FROM nexora_claim_durable_jobs('worker-ci-1', 1, 30);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Retryable durable job was not claimable again';
  END IF;

  SELECT nexora_complete_durable_job(
    '79000000-0000-4000-8000-000000000311',
    'worker-ci-1'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Retried durable job could not complete';
  END IF;

  SELECT nexora_complete_durable_job(
    '79000000-0000-4000-8000-000000000311',
    'worker-ci-1'
  ) INTO v_ok;
  IF v_ok THEN
    RAISE EXCEPTION 'Succeeded durable job was completed twice';
  END IF;
END
$block$;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM outbox_events
     WHERE id = '79000000-0000-4000-8000-000000000111'
       AND processed_at IS NOT NULL
       AND dead_lettered_at IS NULL
       AND lease_owner IS NULL
  ) THEN
    RAISE EXCEPTION 'Outbox success terminal state was not persisted correctly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM outbox_events
     WHERE id = '79000000-0000-4000-8000-000000000112'
       AND processed_at IS NULL
       AND dead_lettered_at IS NOT NULL
       AND attempts = max_attempts
       AND lease_owner IS NULL
  ) THEN
    RAISE EXCEPTION 'Outbox dead-letter terminal state was not persisted correctly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM durable_jobs
     WHERE id = '79000000-0000-4000-8000-000000000311'
       AND status = 'succeeded'
       AND attempt = 2
       AND finished_at IS NOT NULL
       AND locked_by IS NULL
  ) THEN
    RAISE EXCEPTION 'Durable job retry/success state was not persisted correctly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM durable_jobs
     WHERE id = '79000000-0000-4000-8000-000000000312'
       AND status = 'dead_lettered'
       AND attempt = max_attempts
       AND finished_at IS NOT NULL
       AND locked_by IS NULL
  ) THEN
    RAISE EXCEPTION 'Durable job dead-letter state was not persisted correctly';
  END IF;
END
$block$;

COMMIT;
