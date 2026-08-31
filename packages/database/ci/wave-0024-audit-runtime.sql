BEGIN;

SELECT set_config('app.tenant_id', '74000000-0000-4000-8000-000000000001', true);

INSERT INTO audit_events (
  id, tenant_id, action, outcome, source, entity_type, entity_id,
  actor_type, correlation_id, request_id, metadata
) VALUES (
  '74000000-0000-4000-8000-000000000101',
  '74000000-0000-4000-8000-000000000001',
  'trip.status.changed', 'success', 'api', 'trip',
  '74000000-0000-4000-8000-000000000201',
  'system', 'corr-wave-0024-a', 'req-wave-0024-a',
  '{"wave":"0024","tenant":"a"}'::jsonb
);

INSERT INTO audit_changes (
  id, tenant_id, audit_event_id, field_path, operation, before_value, after_value
) VALUES (
  '74000000-0000-4000-8000-000000000102',
  '74000000-0000-4000-8000-000000000001',
  '74000000-0000-4000-8000-000000000101',
  'status', 'replace', '"ready"'::jsonb, '"in_transit"'::jsonb
);

DO $block$
DECLARE
  v_count integer;
  v_blocked boolean := false;
BEGIN
  SELECT count(*) INTO v_count
    FROM audit_events
   WHERE id = '74000000-0000-4000-8000-000000000101';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant A cannot read its own audit event';
  END IF;

  BEGIN
    INSERT INTO audit_changes (
      id, tenant_id, audit_event_id, field_path, operation,
      before_value, after_value, sensitive
    ) VALUES (
      '74000000-0000-4000-8000-000000000103',
      '74000000-0000-4000-8000-000000000001',
      '74000000-0000-4000-8000-000000000101',
      'payment.token', 'replace', '"old-secret"'::jsonb, '"new-secret"'::jsonb, true
    );
  EXCEPTION WHEN OTHERS THEN
    IF position('audit_changes_sensitive_payload_check' in SQLERRM) > 0 THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Sensitive before/after payload was accepted unexpectedly';
  END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO audit_events (
      id, tenant_id, action, source, entity_type, actor_type
    ) VALUES (
      '74000000-0000-4000-8000-000000000104',
      '74000000-0000-4000-8000-000000000002',
      'cross.tenant.write', 'api', 'trip', 'system'
    );
  EXCEPTION WHEN OTHERS THEN
    IF position('row-level security' in lower(SQLERRM)) > 0 THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Cross-tenant audit insert was accepted unexpectedly';
  END IF;
END
$block$;

SELECT set_config('app.tenant_id', '74000000-0000-4000-8000-000000000002', true);

DO $block$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM audit_events;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Tenant B can see Tenant A audit events: % rows', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM audit_changes;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Tenant B can see Tenant A audit changes: % rows', v_count;
  END IF;
END
$block$;

SELECT set_config('app.tenant_id', '74000000-0000-4000-8000-000000000001', true);

DO $block$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
    FROM audit_events
   WHERE id = '74000000-0000-4000-8000-000000000101';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant A audit event disappeared after tenant switch';
  END IF;

  SELECT count(*) INTO v_count
    FROM audit_changes
   WHERE id = '74000000-0000-4000-8000-000000000102';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tenant A audit change disappeared after tenant switch';
  END IF;
END
$block$;

ROLLBACK;
