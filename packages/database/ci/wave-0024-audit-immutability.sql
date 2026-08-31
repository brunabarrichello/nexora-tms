BEGIN;

DO $block$
DECLARE
  v_event_id uuid := gen_random_uuid();
  v_change_id uuid := gen_random_uuid();
  v_blocked boolean;
  v_action text;
  v_operation text;
BEGIN
  INSERT INTO audit_events (
    id,
    tenant_id,
    action,
    outcome,
    source,
    entity_type,
    entity_id,
    actor_type,
    correlation_id,
    request_id,
    metadata
  ) VALUES (
    v_event_id,
    '74000000-0000-4000-8000-000000000001',
    'trip.status.changed',
    'success',
    'migration',
    'trip',
    '74000000-0000-4000-8000-000000000201',
    'system',
    'corr-wave-0024-immutability',
    'req-wave-0024-immutability',
    '{"wave":"0024","test":"immutability"}'::jsonb
  );

  INSERT INTO audit_changes (
    id,
    tenant_id,
    audit_event_id,
    field_path,
    operation,
    before_value,
    after_value
  ) VALUES (
    v_change_id,
    '74000000-0000-4000-8000-000000000001',
    v_event_id,
    'status',
    'replace',
    '"ready"'::jsonb,
    '"in_transit"'::jsonb
  );

  v_blocked := false;
  BEGIN
    UPDATE audit_events
       SET action = 'tampered.event'
     WHERE id = v_event_id;
  EXCEPTION WHEN OTHERS THEN
    IF position('audit records are immutable' in lower(SQLERRM)) > 0 THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Owner UPDATE on audit_events was accepted unexpectedly';
  END IF;

  v_blocked := false;
  BEGIN
    DELETE FROM audit_events
     WHERE id = v_event_id;
  EXCEPTION WHEN OTHERS THEN
    IF position('audit records are immutable' in lower(SQLERRM)) > 0 THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Owner DELETE on audit_events was accepted unexpectedly';
  END IF;

  v_blocked := false;
  BEGIN
    UPDATE audit_changes
       SET operation = 'set'
     WHERE id = v_change_id;
  EXCEPTION WHEN OTHERS THEN
    IF position('audit records are immutable' in lower(SQLERRM)) > 0 THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Owner UPDATE on audit_changes was accepted unexpectedly';
  END IF;

  v_blocked := false;
  BEGIN
    DELETE FROM audit_changes
     WHERE id = v_change_id;
  EXCEPTION WHEN OTHERS THEN
    IF position('audit records are immutable' in lower(SQLERRM)) > 0 THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Owner DELETE on audit_changes was accepted unexpectedly';
  END IF;

  SELECT action INTO v_action
    FROM audit_events
   WHERE id = v_event_id;
  IF v_action <> 'trip.status.changed' THEN
    RAISE EXCEPTION 'Audit event changed despite immutable trigger: %', v_action;
  END IF;

  SELECT operation INTO v_operation
    FROM audit_changes
   WHERE id = v_change_id;
  IF v_operation <> 'replace' THEN
    RAISE EXCEPTION 'Audit change changed despite immutable trigger: %', v_operation;
  END IF;
END
$block$;

ROLLBACK;
