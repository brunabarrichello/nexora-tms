DO $$
DECLARE
  v_count integer;
BEGIN
  IF to_regprocedure('nexora_assert_async_admin()') IS NULL
     OR to_regprocedure('nexora_admin_requeue_outbox_event(uuid,text)') IS NULL
     OR to_regprocedure('nexora_admin_requeue_durable_job(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'NEX-55 administrative reprocessing functions are missing';
  END IF;

  SELECT count(*)::int INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname IN (
       'nexora_assert_async_admin',
       'nexora_admin_requeue_outbox_event',
       'nexora_admin_requeue_durable_job'
     )
     AND p.prosecdef;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'NEX-55 protected functions must all be SECURITY DEFINER; found % of 3', v_count;
  END IF;

  IF NOT has_function_privilege(
    'nexora_app',
    'nexora_admin_requeue_outbox_event(uuid,text)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'nexora_app',
    'nexora_admin_requeue_durable_job(uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'nexora_app must execute only the NEX-55 tenant-safe admin wrappers';
  END IF;

  IF has_function_privilege(
    'nexora_app',
    'nexora_assert_async_admin()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'nexora_app must not execute the internal authorization helper directly';
  END IF;

  IF has_function_privilege(
    'nexora_app',
    'nexora_requeue_dead_lettered_outbox_event(uuid,timestamp with time zone)',
    'EXECUTE'
  ) OR has_function_privilege(
    'nexora_app',
    'nexora_requeue_dead_lettered_job(uuid,timestamp with time zone)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'nexora_app gained unsafe direct access to owner-only requeue primitives';
  END IF;

  IF has_function_privilege(
    'nexora_worker',
    'nexora_admin_requeue_outbox_event(uuid,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'nexora_worker',
    'nexora_admin_requeue_durable_job(uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'nexora_worker must not receive administrative reprocessing privileges';
  END IF;

  IF NOT has_table_privilege('nexora_app','outbox_events','SELECT')
     OR NOT has_table_privilege('nexora_app','durable_jobs','SELECT') THEN
    RAISE EXCEPTION 'nexora_app must retain tenant-scoped async read access';
  END IF;

  IF has_table_privilege('nexora_app','outbox_events','UPDATE')
     OR has_table_privilege('nexora_app','durable_jobs','UPDATE')
     OR has_table_privilege('nexora_app','outbox_events','DELETE')
     OR has_table_privilege('nexora_app','durable_jobs','DELETE') THEN
    RAISE EXCEPTION 'nexora_app gained unsafe direct async mutation privilege';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a
     WHERE n.nspname='public'
       AND p.proname IN (
         'nexora_assert_async_admin',
         'nexora_admin_requeue_outbox_event',
         'nexora_admin_requeue_durable_job'
       )
       AND a.grantee=0
       AND a.privilege_type='EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC can execute one or more NEX-55 protected functions';
  END IF;

  RAISE NOTICE 'NEX-55 admin wrappers, least privilege and owner-function isolation verified';
END;
$$;
