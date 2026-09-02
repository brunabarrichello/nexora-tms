\set ON_ERROR_STOP on

BEGIN;

DO $block$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
    FROM audit_events
   WHERE entity_id IN (
     '79000000-0000-4000-8000-000000000111',
     '79000000-0000-4000-8000-000000000112',
     '79000000-0000-4000-8000-000000000311',
     '79000000-0000-4000-8000-000000000312'
   )
     AND action IN (
       'async.outbox.processed',
       'async.outbox.dead_lettered',
       'async.job.retry_scheduled',
       'async.job.succeeded',
       'async.job.dead_lettered'
     );
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'Expected five worker execution audit events, found %', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM audit_events
     WHERE entity_id = '79000000-0000-4000-8000-000000000111'
       AND action = 'async.outbox.processed'
       AND source = 'worker'
       AND actor_type = 'service'
       AND actor_external_id = 'worker-ci-1'
       AND correlation_id = 'corr-worker-a'
       AND request_id = 'req-worker-a'
       AND idempotency_key = 'nex90-worker-outbox-a'
  ) THEN
    RAISE EXCEPTION 'Outbox completion audit metadata is incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM audit_events
     WHERE entity_id = '79000000-0000-4000-8000-000000000312'
       AND action = 'async.job.dead_lettered'
       AND outcome = 'failure'
       AND source = 'worker'
       AND actor_external_id = 'worker-ci-2'
       AND idempotency_key = 'nex90-worker-job-b'
  ) THEN
    RAISE EXCEPTION 'Durable-job dead-letter audit metadata is incomplete';
  END IF;
END
$block$;

DO $block$
DECLARE
  v_ok boolean;
  v_outbox_key text;
  v_job_key text;
  v_count integer;
BEGIN
  SELECT idempotency_key INTO v_outbox_key
    FROM outbox_events
   WHERE id = '79000000-0000-4000-8000-000000000112';
  SELECT idempotency_key INTO v_job_key
    FROM durable_jobs
   WHERE id = '79000000-0000-4000-8000-000000000312';

  SELECT nexora_requeue_dead_lettered_outbox_event(
    '79000000-0000-4000-8000-000000000112',
    now() + interval '10 seconds'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Owner could not requeue dead-lettered outbox event';
  END IF;

  SELECT nexora_requeue_dead_lettered_job(
    '79000000-0000-4000-8000-000000000312',
    now() + interval '10 seconds'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Owner could not requeue dead-lettered durable job';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM outbox_events
     WHERE id = '79000000-0000-4000-8000-000000000112'
       AND attempts = 0
       AND processed_at IS NULL
       AND dead_lettered_at IS NULL
       AND dead_letter_reason IS NULL
       AND lease_owner IS NULL
       AND available_at > now()
       AND idempotency_key = v_outbox_key
  ) THEN
    RAISE EXCEPTION 'Outbox controlled requeue did not preserve identity/reset terminal state';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM durable_jobs
     WHERE id = '79000000-0000-4000-8000-000000000312'
       AND status = 'retry_wait'
       AND attempt = 0
       AND finished_at IS NULL
       AND locked_by IS NULL
       AND run_at > now()
       AND idempotency_key = v_job_key
  ) THEN
    RAISE EXCEPTION 'Durable-job controlled requeue did not preserve identity/reset terminal state';
  END IF;

  SELECT count(*) INTO v_count
    FROM audit_events
   WHERE (entity_id = '79000000-0000-4000-8000-000000000112' AND action = 'async.outbox.requeued')
      OR (entity_id = '79000000-0000-4000-8000-000000000312' AND action = 'async.job.requeued');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Controlled reprocessing was not fully audited, found % events', v_count;
  END IF;

  SELECT nexora_requeue_dead_lettered_outbox_event(
    '79000000-0000-4000-8000-000000000112',
    now()
  ) INTO v_ok;
  IF v_ok THEN
    RAISE EXCEPTION 'Non-dead-lettered outbox event was requeued twice';
  END IF;

  SELECT nexora_requeue_dead_lettered_job(
    '79000000-0000-4000-8000-000000000312',
    now()
  ) INTO v_ok;
  IF v_ok THEN
    RAISE EXCEPTION 'Non-dead-lettered durable job was requeued twice';
  END IF;
END
$block$;

ROLLBACK;
