\set ON_ERROR_STOP on

DO $block$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
    FROM pg_class
   WHERE relname IN ('outbox_events', 'durable_jobs')
     AND relnamespace = 'public'::regnamespace
     AND relrowsecurity;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected RLS enabled on both async tables, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
    FROM pg_policies
   WHERE schemaname = 'public'
     AND policyname IN (
       'outbox_events_tenant_isolation',
       'durable_jobs_tenant_isolation',
       'outbox_events_worker_cross_tenant',
       'durable_jobs_worker_cross_tenant',
       'audit_events_worker_insert'
     );
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'Expected five async/worker RLS policies, found %', v_count;
  END IF;

  IF NOT has_table_privilege('nexora_app', 'public.outbox_events', 'SELECT')
     OR NOT has_table_privilege('nexora_app', 'public.outbox_events', 'INSERT')
     OR NOT has_table_privilege('nexora_app', 'public.durable_jobs', 'SELECT')
     OR NOT has_table_privilege('nexora_app', 'public.durable_jobs', 'INSERT') THEN
    RAISE EXCEPTION 'nexora_app is missing required async producer privileges';
  END IF;

  IF has_table_privilege('nexora_app', 'public.outbox_events', 'UPDATE')
     OR has_table_privilege('nexora_app', 'public.outbox_events', 'DELETE')
     OR has_table_privilege('nexora_app', 'public.durable_jobs', 'UPDATE')
     OR has_table_privilege('nexora_app', 'public.durable_jobs', 'DELETE') THEN
    RAISE EXCEPTION 'nexora_app received async consumer/destructive privileges unexpectedly';
  END IF;

  IF NOT has_table_privilege('nexora_worker', 'public.outbox_events', 'SELECT')
     OR NOT has_table_privilege('nexora_worker', 'public.outbox_events', 'INSERT')
     OR NOT has_table_privilege('nexora_worker', 'public.outbox_events', 'UPDATE')
     OR NOT has_table_privilege('nexora_worker', 'public.durable_jobs', 'SELECT')
     OR NOT has_table_privilege('nexora_worker', 'public.durable_jobs', 'INSERT')
     OR NOT has_table_privilege('nexora_worker', 'public.durable_jobs', 'UPDATE')
     OR NOT has_table_privilege('nexora_worker', 'public.audit_events', 'INSERT') THEN
    RAISE EXCEPTION 'nexora_worker is missing required async consumer/audit privileges';
  END IF;

  IF has_table_privilege('nexora_worker', 'public.outbox_events', 'DELETE')
     OR has_table_privilege('nexora_worker', 'public.durable_jobs', 'DELETE')
     OR has_table_privilege('nexora_worker', 'public.audit_events', 'UPDATE')
     OR has_table_privilege('nexora_worker', 'public.audit_events', 'DELETE') THEN
    RAISE EXCEPTION 'nexora_worker received destructive privileges unexpectedly';
  END IF;

  SELECT count(*) INTO v_count
    FROM pg_roles
   WHERE rolname = 'nexora_worker'
     AND rolbypassrls;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'nexora_worker must not have BYPASSRLS';
  END IF;

  IF NOT has_function_privilege('nexora_worker', 'public.nexora_claim_outbox_events(text,integer,integer)', 'EXECUTE')
     OR NOT has_function_privilege('nexora_worker', 'public.nexora_complete_outbox_event(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('nexora_worker', 'public.nexora_fail_outbox_event(uuid,text,text,integer,integer)', 'EXECUTE')
     OR NOT has_function_privilege('nexora_worker', 'public.nexora_claim_durable_jobs(text,integer,integer)', 'EXECUTE')
     OR NOT has_function_privilege('nexora_worker', 'public.nexora_complete_durable_job(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('nexora_worker', 'public.nexora_fail_durable_job(uuid,text,text,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'nexora_worker is missing async processing function privileges';
  END IF;

  IF has_function_privilege('nexora_app', 'public.nexora_claim_outbox_events(text,integer,integer)', 'EXECUTE')
     OR has_function_privilege('nexora_app', 'public.nexora_claim_durable_jobs(text,integer,integer)', 'EXECUTE')
     OR has_function_privilege('nexora_app', 'public.nexora_complete_outbox_event(uuid,text)', 'EXECUTE')
     OR has_function_privilege('nexora_app', 'public.nexora_complete_durable_job(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'nexora_app unexpectedly received worker execution privileges';
  END IF;

  IF has_function_privilege('nexora_worker', 'public.nexora_requeue_dead_lettered_outbox_event(uuid,timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('nexora_worker', 'public.nexora_requeue_dead_lettered_job(uuid,timestamp with time zone)', 'EXECUTE') THEN
    RAISE EXCEPTION 'nexora_worker unexpectedly received administrative requeue privileges';
  END IF;

  IF NOT has_function_privilege('nexora_owner', 'public.nexora_requeue_dead_lettered_outbox_event(uuid,timestamp with time zone)', 'EXECUTE')
     OR NOT has_function_privilege('nexora_owner', 'public.nexora_requeue_dead_lettered_job(uuid,timestamp with time zone)', 'EXECUTE') THEN
    RAISE EXCEPTION 'nexora_owner is missing controlled requeue privileges';
  END IF;
END
$block$;

INSERT INTO tenants (id, slug, name, status)
VALUES
  ('79000000-0000-4000-8000-000000000001', 'nex90-tenant-a', 'NEX-90 Tenant A', 'active'),
  ('79000000-0000-4000-8000-000000000002', 'nex90-tenant-b', 'NEX-90 Tenant B', 'active')
ON CONFLICT (id) DO NOTHING;
