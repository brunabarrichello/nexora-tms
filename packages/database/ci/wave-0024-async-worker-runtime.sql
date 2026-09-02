\set ON_ERROR_STOP on

BEGIN;

INSERT INTO outbox_events (
  id, tenant_id, aggregate_type, aggregate_id, event_type, payload,
  idempotency_key, correlation_id
) VALUES
  (
    '79000000-0000-4000-8000-000000000111',
    '79000000-0000-4000-8000-000000000001',
    'trip', 'worker-a', 'trip.created', '{"tenant":"a"}'::jsonb,
    'nex90-worker-outbox-a', 'corr-worker-a'
  ),
  (
    '79000000-0000-4000-8000-000000000112',
    '79000000-0000-4000-8000-000000000002',
    'trip', 'worker-b', 'trip.created', '{"tenant":"b"}'::jsonb,
    'nex90-worker-outbox-b', 'corr-worker-b'
  );

INSERT INTO durable_jobs (
  id, tenant_id, source_outbox_event_id, job_type, payload,
  idempotency_key, correlation_id
) VALUES
  (
    '79000000-0000-4000-8000-000000000311',
    '79000000-0000-4000-8000-000000000001',
    '79000000-0000-4000-8000-000000000111',
    'trip.created.dispatch', '{"tenant":"a"}'::jsonb,
    'nex90-worker-job-a', 'corr-worker-a'
  ),
  (
    '79000000-0000-4000-8000-000000000312',
    '79000000-0000-4000-8000-000000000002',
    '79000000-0000-4000-8000-000000000112',
    'trip.created.dispatch', '{"tenant":"b"}'::jsonb,
    'nex90-worker-job-b', 'corr-worker-b'
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

UPDATE outbox_events
   SET attempts = attempts + 1,
       lease_owner = 'worker-ci-1',
       lease_expires_at = now() + interval '30 seconds',
       updated_at = now()
 WHERE id = '79000000-0000-4000-8000-000000000111';

UPDATE outbox_events
   SET processed_at = now(),
       lease_owner = NULL,
       lease_expires_at = NULL,
       updated_at = now()
 WHERE id = '79000000-0000-4000-8000-000000000111';

UPDATE outbox_events
   SET attempts = max_attempts,
       dead_lettered_at = now(),
       dead_letter_reason = 'ci terminal failure',
       last_error = 'synthetic failure',
       updated_at = now()
 WHERE id = '79000000-0000-4000-8000-000000000112';

UPDATE durable_jobs
   SET status = 'running',
       attempt = attempt + 1,
       locked_at = now(),
       locked_by = 'worker-ci-1',
       lease_expires_at = now() + interval '30 seconds',
       updated_at = now()
 WHERE id = '79000000-0000-4000-8000-000000000311';

UPDATE durable_jobs
   SET status = 'succeeded',
       locked_at = NULL,
       locked_by = NULL,
       lease_expires_at = NULL,
       finished_at = now(),
       updated_at = now()
 WHERE id = '79000000-0000-4000-8000-000000000311';

UPDATE durable_jobs
   SET status = 'retry_wait',
       attempt = attempt + 1,
       run_at = now() + interval '1 minute',
       last_error = 'synthetic retry',
       updated_at = now()
 WHERE id = '79000000-0000-4000-8000-000000000312';

UPDATE durable_jobs
   SET status = 'dead_lettered',
       attempt = max_attempts,
       last_error = 'synthetic terminal failure',
       finished_at = now(),
       updated_at = now()
 WHERE id = '79000000-0000-4000-8000-000000000312';

DO $block$
DECLARE
  v_status text;
  v_processed timestamptz;
  v_dead timestamptz;
BEGIN
  SELECT processed_at INTO v_processed
    FROM outbox_events
   WHERE id = '79000000-0000-4000-8000-000000000111';
  IF v_processed IS NULL THEN
    RAISE EXCEPTION 'Worker did not persist outbox completion';
  END IF;

  SELECT dead_lettered_at INTO v_dead
    FROM outbox_events
   WHERE id = '79000000-0000-4000-8000-000000000112';
  IF v_dead IS NULL THEN
    RAISE EXCEPTION 'Worker did not persist outbox dead-letter state';
  END IF;

  SELECT status INTO v_status
    FROM durable_jobs
   WHERE id = '79000000-0000-4000-8000-000000000311';
  IF v_status <> 'succeeded' THEN
    RAISE EXCEPTION 'Expected succeeded durable job, got %', v_status;
  END IF;

  SELECT status INTO v_status
    FROM durable_jobs
   WHERE id = '79000000-0000-4000-8000-000000000312';
  IF v_status <> 'dead_lettered' THEN
    RAISE EXCEPTION 'Expected dead-lettered durable job, got %', v_status;
  END IF;
END
$block$;

ROLLBACK;
