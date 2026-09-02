DO $$
DECLARE
  v_delivery webhook_deliveries%ROWTYPE;
  v_job durable_jobs%ROWTYPE;
  v_attempts integer;
  v_failures integer;
  v_successes integer;
  v_audit integer;
BEGIN
  SELECT d.* INTO v_delivery
    FROM webhook_deliveries d
   WHERE d.tenant_id='78200000-0000-4000-8000-000000000001'
     AND d.subscription_id='78200000-0000-4000-8000-000000000601'
     AND d.outbox_event_id='78200000-0000-4000-8000-000000000701';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NEX-56 delivery is missing';
  END IF;
  IF v_delivery.status <> 'succeeded' OR v_delivery.succeeded_at IS NULL THEN
    RAISE EXCEPTION 'NEX-56 delivery did not succeed after reprocessing: %', v_delivery.status;
  END IF;
  IF v_delivery.attempts <> 3 THEN
    RAISE EXCEPTION 'NEX-56 delivery attempt history expected 3, got %', v_delivery.attempts;
  END IF;
  IF v_delivery.idempotency_key <> 'webhook:78200000-0000-4000-8000-000000000601:78200000-0000-4000-8000-000000000701' THEN
    RAISE EXCEPTION 'NEX-56 idempotency key changed: %', v_delivery.idempotency_key;
  END IF;

  SELECT j.* INTO v_job
    FROM durable_jobs j
   WHERE j.id=v_delivery.durable_job_id;
  IF NOT FOUND OR v_job.status <> 'succeeded' THEN
    RAISE EXCEPTION 'NEX-56 durable webhook job is not succeeded';
  END IF;
  IF v_job.idempotency_key <> v_delivery.idempotency_key THEN
    RAISE EXCEPTION 'delivery and durable job idempotency keys diverged';
  END IF;
  IF v_job.correlation_id <> 'nex56-correlation-001' OR v_job.request_id <> 'nex56-request-001' THEN
    RAISE EXCEPTION 'correlation/request metadata was not preserved';
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE outcome='failure'),
         count(*) FILTER (WHERE outcome='success')
    INTO v_attempts,v_failures,v_successes
    FROM webhook_delivery_attempts
   WHERE tenant_id=v_delivery.tenant_id AND delivery_id=v_delivery.id;
  IF v_attempts <> 3 OR v_failures <> 2 OR v_successes <> 1 THEN
    RAISE EXCEPTION 'unexpected webhook attempt ledger: total %, failures %, successes %', v_attempts,v_failures,v_successes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM integration_clients
     WHERE id='78200000-0000-4000-8000-000000000501'
       AND tenant_id='78200000-0000-4000-8000-000000000001'
       AND last_used_at IS NOT NULL
       AND octet_length(secret_hash)=32
  ) THEN
    RAISE EXCEPTION 'integration client hash/authentication evidence missing';
  END IF;

  FOR v_audit IN
    SELECT count(*) FROM audit_events
     WHERE tenant_id='78200000-0000-4000-8000-000000000001'
       AND action='integration.webhook.queued'
  LOOP
    IF v_audit <> 1 THEN RAISE EXCEPTION 'expected one webhook queued audit, got %', v_audit; END IF;
  END LOOP;

  SELECT count(*) INTO v_audit FROM audit_events
   WHERE tenant_id=v_delivery.tenant_id AND action='integration.webhook.delivery_failed';
  IF v_audit <> 2 THEN RAISE EXCEPTION 'expected two delivery failure audits, got %', v_audit; END IF;

  SELECT count(*) INTO v_audit FROM audit_events
   WHERE tenant_id=v_delivery.tenant_id AND action='integration.webhook.delivery_succeeded';
  IF v_audit <> 1 THEN RAISE EXCEPTION 'expected one delivery success audit, got %', v_audit; END IF;

  SELECT count(*) INTO v_audit FROM audit_events
   WHERE tenant_id=v_delivery.tenant_id AND action='async.job.reprocess_requested'
     AND entity_id=v_job.id::text
     AND actor_type='user'
     AND actor_user_id='78200000-0000-4000-8000-000000000101';
  IF v_audit <> 1 THEN RAISE EXCEPTION 'administrative reprocess audit is missing'; END IF;

  SELECT count(*) INTO v_audit FROM audit_events
   WHERE tenant_id=v_delivery.tenant_id AND action='integration.api.authenticated'
     AND entity_id='78200000-0000-4000-8000-000000000501';
  IF v_audit < 1 THEN RAISE EXCEPTION 'successful integration authentication audit is missing'; END IF;

  SELECT count(*) INTO v_audit FROM audit_events
   WHERE tenant_id=v_delivery.tenant_id AND action='integration.api.authentication_denied'
     AND entity_id='78200000-0000-4000-8000-000000000501';
  IF v_audit < 1 THEN RAISE EXCEPTION 'denied integration authentication audit is missing'; END IF;
END $$;