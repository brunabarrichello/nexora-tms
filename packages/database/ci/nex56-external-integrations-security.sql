DO $$
DECLARE
  v_table text;
  v_rls boolean;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'integration_clients','webhook_subscriptions','webhook_deliveries','webhook_delivery_attempts'
  ] LOOP
    SELECT c.relrowsecurity INTO v_rls
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname=v_table;
    IF coalesce(v_rls,false) IS NOT TRUE THEN
      RAISE EXCEPTION 'RLS is not enabled for %', v_table;
    END IF;
  END LOOP;

  IF NOT has_function_privilege(
    'nexora_app','nexora_authenticate_integration_client(uuid,text)','EXECUTE'
  ) THEN
    RAISE EXCEPTION 'nexora_app cannot authenticate integration clients';
  END IF;

  IF has_function_privilege(
    'public','nexora_authenticate_integration_client(uuid,text)','EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC can execute integration authentication';
  END IF;

  IF NOT has_function_privilege(
    'nexora_worker','nexora_worker_get_webhook_delivery(uuid)','EXECUTE'
  ) OR NOT has_function_privilege(
    'nexora_worker',
    'nexora_worker_record_webhook_attempt(uuid,integer,text,integer,integer,text,boolean)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'nexora_worker is missing controlled webhook function access';
  END IF;

  IF has_table_privilege('nexora_worker','integration_clients','SELECT')
     OR has_table_privilege('nexora_worker','webhook_subscriptions','SELECT')
     OR has_table_privilege('nexora_worker','webhook_deliveries','SELECT') THEN
    RAISE EXCEPTION 'nexora_worker gained direct access to integration tables';
  END IF;

  IF has_column_privilege('nexora_app','integration_clients','secret_hash','SELECT') THEN
    RAISE EXCEPTION 'nexora_app can read integration secret hashes';
  END IF;

  IF has_column_privilege('nexora_app','webhook_subscriptions','signing_secret_ciphertext','SELECT')
     OR has_column_privilege('nexora_app','webhook_subscriptions','signing_secret_iv','SELECT')
     OR has_column_privilege('nexora_app','webhook_subscriptions','signing_secret_tag','SELECT') THEN
    RAISE EXCEPTION 'nexora_app can read encrypted webhook signing material';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid='outbox_events'::regclass
       AND tgname='outbox_events_webhook_fanout'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'webhook fanout trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid='durable_jobs'::regclass
       AND tgname='durable_jobs_webhook_delivery_sync'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'webhook durable-job sync trigger is missing';
  END IF;
END $$;