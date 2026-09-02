\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.tenant_id', '79000000-0000-4000-8000-000000000001', true);

INSERT INTO outbox_events (
  id, tenant_id, aggregate_type, aggregate_id, event_type, payload,
  idempotency_key, correlation_id, request_id
) VALUES (
  '79000000-0000-4000-8000-000000000101',
  '79000000-0000-4000-8000-000000000001',
  'trip', '79000000-0000-4000-8000-000000000201', 'trip.created',
  '{"tripId":"79000000-0000-4000-8000-000000000201"}'::jsonb,
  'nex90-outbox-a-1', 'corr-nex90-a', 'req-nex90-a'
);

INSERT INTO durable_jobs (
  id, tenant_id, source_outbox_event_id, job_type, payload,
  idempotency_key, correlation_id, request_id
) VALUES (
  '79000000-0000-4000-8000-000000000301',
  '79000000-0000-4000-8000-000000000001',
  '79000000-0000-4000-8000-000000000101',
  'trip.created.dispatch',
  '{"tripId":"79000000-0000-4000-8000-000000000201"}'::jsonb,
  'nex90-job-a-1', 'corr-nex90-a', 'req-nex90-a'
);

DO $block$
DECLARE
  v_count integer;
  v_blocked boolean := false;
BEGIN
  SELECT count(*) INTO v_count
    FROM outbox_events
   WHERE id = '79000000-0000-4000-8000-000000000101';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant A cannot read its own outbox event';
  END IF;

  SELECT count(*) INTO v_count
    FROM durable_jobs
   WHERE id = '79000000-0000-4000-8000-000000000301';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant A cannot read its own durable job';
  END IF;

  BEGIN
    INSERT INTO outbox_events (
      tenant_id, aggregate_type, aggregate_id, event_type, payload, idempotency_key
    ) VALUES (
      '79000000-0000-4000-8000-000000000001',
      'trip', 'duplicate', 'trip.created', '{}'::jsonb, 'nex90-outbox-a-1'
    );
  EXCEPTION WHEN unique_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Duplicate outbox idempotency key was accepted';
  END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO durable_jobs (
      tenant_id, job_type, payload, idempotency_key
    ) VALUES (
      '79000000-0000-4000-8000-000000000001',
      'duplicate', '{}'::jsonb, 'nex90-job-a-1'
    );
  EXCEPTION WHEN unique_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Duplicate durable job idempotency key was accepted';
  END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO outbox_events (
      tenant_id, aggregate_type, aggregate_id, event_type, payload, idempotency_key
    ) VALUES (
      '79000000-0000-4000-8000-000000000002',
      'trip', 'cross-tenant', 'trip.created', '{}'::jsonb, 'nex90-outbox-cross'
    );
  EXCEPTION WHEN OTHERS THEN
    IF position('row-level security' in lower(SQLERRM)) > 0 THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Cross-tenant outbox insert was accepted';
  END IF;

  v_blocked := false;
  BEGIN
    UPDATE outbox_events
       SET processed_at = now()
     WHERE id = '79000000-0000-4000-8000-000000000101';
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'nexora_app unexpectedly updated outbox consumer state';
  END IF;
END
$block$;

SELECT set_config('app.tenant_id', '79000000-0000-4000-8000-000000000002', true);

DO $block$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM outbox_events;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Tenant B can see Tenant A outbox rows: %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM durable_jobs;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Tenant B can see Tenant A durable jobs: %', v_count;
  END IF;
END
$block$;

ROLLBACK;
