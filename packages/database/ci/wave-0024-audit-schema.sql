DO $block$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
    FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('audit_events', 'audit_changes');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 Wave 0024 audit tables, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('audit_events', 'audit_changes')
     AND c.relrowsecurity;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected RLS on both Wave 0024 audit tables, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('audit_events', 'audit_changes')
     AND policyname IN ('audit_events_tenant_isolation', 'audit_changes_tenant_isolation');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected both Wave 0024 tenant-isolation policies, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND NOT t.tgisinternal
     AND t.tgname IN ('audit_events_immutable', 'audit_changes_immutable');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected both immutable audit triggers, found %', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'nexora_prevent_audit_mutation'
  ) THEN
    RAISE EXCEPTION 'Audit mutation prevention function is missing';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(ARRAY['audit_events', 'audit_changes']) AS x(table_name)
     WHERE NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'SELECT')
        OR NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'INSERT')
        OR has_table_privilege('nexora_app', format('public.%I', table_name), 'UPDATE')
        OR has_table_privilege('nexora_app', format('public.%I', table_name), 'DELETE')
  ) THEN
    RAISE EXCEPTION 'Wave 0024 append-only runtime grants are incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'audit_changes_sensitive_payload_check'
  ) THEN
    RAISE EXCEPTION 'Sensitive audit payload constraint is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'audit_changes_event_fk'
  ) THEN
    RAISE EXCEPTION 'Tenant-scoped audit change FK is missing';
  END IF;
END
$block$;
