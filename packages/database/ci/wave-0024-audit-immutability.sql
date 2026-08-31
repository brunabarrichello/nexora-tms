DO $block$
DECLARE
  v_blocked boolean;
  v_action text;
  v_operation text;
BEGIN
  v_blocked := false;
  BEGIN
    UPDATE audit_events
       SET action = 'tampered.event'
     WHERE id = '74000000-0000-4000-8000-000000000101';
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
     WHERE id = '74000000-0000-4000-8000-000000000101';
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
     WHERE id = '74000000-0000-4000-8000-000000000102';
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
     WHERE id = '74000000-0000-4000-8000-000000000102';
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
   WHERE id = '74000000-0000-4000-8000-000000000101';
  IF v_action <> 'trip.status.changed' THEN
    RAISE EXCEPTION 'Audit event changed despite immutable trigger: %', v_action;
  END IF;

  SELECT operation INTO v_operation
    FROM audit_changes
   WHERE id = '74000000-0000-4000-8000-000000000102';
  IF v_operation <> 'replace' THEN
    RAISE EXCEPTION 'Audit change changed despite immutable trigger: %', v_operation;
  END IF;
END
$block$;
