DO $$
DECLARE
  v_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM outbox_events
     WHERE id='78000000-0000-4000-8000-000000000501'
       AND tenant_id='78000000-0000-4000-8000-000000000001'
       AND processed_at IS NOT NULL
       AND dead_lettered_at IS NULL
       AND attempts=1
       AND idempotency_key='nex55:outbox:notification-001'
  ) THEN
    RAISE EXCEPTION 'NEX-55 outbox fixture did not finish successfully after reprocessing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM durable_jobs
     WHERE id='78000000-0000-4000-8000-000000000601'
       AND tenant_id='78000000-0000-4000-8000-000000000001'
       AND status='succeeded'
       AND attempt=1
       AND idempotency_key='nex55:job:smoke-001'
  ) THEN
    RAISE EXCEPTION 'NEX-55 durable job fixture did not finish successfully after reprocessing';
  END IF;

  SELECT count(DISTINCT action)::int INTO v_count
    FROM audit_events
   WHERE entity_type='outbox_event'
     AND entity_id='78000000-0000-4000-8000-000000000501'
     AND action IN (
       'async.outbox.retry_scheduled',
       'async.outbox.dead_lettered',
       'async.outbox.requeued',
       'async.outbox.reprocess_requested',
       'async.outbox.processed'
     );
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'NEX-55 outbox audit lifecycle incomplete: found % of 5 actions', v_count;
  END IF;

  SELECT count(DISTINCT action)::int INTO v_count
    FROM audit_events
   WHERE entity_type='durable_job'
     AND entity_id='78000000-0000-4000-8000-000000000601'
     AND action IN (
       'async.job.retry_scheduled',
       'async.job.dead_lettered',
       'async.job.requeued',
       'async.job.reprocess_requested',
       'async.job.succeeded'
     );
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'NEX-55 durable job audit lifecycle incomplete: found % of 5 actions', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM audit_events
     WHERE action='async.outbox.reprocess_requested'
       AND entity_id='78000000-0000-4000-8000-000000000501'
       AND actor_type='user'
       AND actor_user_id='78000000-0000-4000-8000-000000000101'
       AND idempotency_key='nex55:outbox:notification-001'
       AND reason='Falha sintética corrigida para qualificação NEX-55'
  ) THEN
    RAISE EXCEPTION 'NEX-55 outbox admin reprocessing audit does not retain actor/reason/idempotency';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM audit_events
     WHERE action='async.job.reprocess_requested'
       AND entity_id='78000000-0000-4000-8000-000000000601'
       AND actor_type='user'
       AND actor_user_id='78000000-0000-4000-8000-000000000101'
       AND idempotency_key='nex55:job:smoke-001'
       AND reason='Falha sintética do job corrigida para qualificação NEX-55'
  ) THEN
    RAISE EXCEPTION 'NEX-55 job admin reprocessing audit does not retain actor/reason/idempotency';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM audit_events
     WHERE entity_id IN (
       '78000000-0000-4000-8000-000000000501',
       '78000000-0000-4000-8000-000000000601'
     )
       AND tenant_id <> '78000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'NEX-55 audit lifecycle crossed tenant boundary';
  END IF;

  RAISE NOTICE 'NEX-55 retry, dead-letter, admin reprocess, success, audit and idempotency verified';
END;
$$;
