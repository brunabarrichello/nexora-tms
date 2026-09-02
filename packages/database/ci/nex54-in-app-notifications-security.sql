DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)::int INTO v_count
    FROM pg_class
   WHERE relnamespace='public'::regnamespace
     AND relname IN ('in_app_notification_events','in_app_notification_deliveries')
     AND relkind='r';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'NEX-54 notification tables missing: found % of 2', v_count;
  END IF;

  SELECT count(*)::int INTO v_count
    FROM pg_class
   WHERE relnamespace='public'::regnamespace
     AND relname IN ('in_app_notification_events','in_app_notification_deliveries')
     AND relrowsecurity;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'NEX-54 RLS is not enabled on both notification tables';
  END IF;

  IF NOT has_table_privilege('nexora_app','in_app_notification_events','SELECT') THEN
    RAISE EXCEPTION 'nexora_app must be able to SELECT notification events';
  END IF;
  IF has_table_privilege('nexora_app','in_app_notification_events','INSERT')
     OR has_table_privilege('nexora_app','in_app_notification_events','UPDATE')
     OR has_table_privilege('nexora_app','in_app_notification_events','DELETE') THEN
    RAISE EXCEPTION 'nexora_app has unsafe write privilege on immutable notification events';
  END IF;

  IF NOT has_table_privilege('nexora_app','in_app_notification_deliveries','SELECT') THEN
    RAISE EXCEPTION 'nexora_app must be able to SELECT notification deliveries';
  END IF;
  IF has_table_privilege('nexora_app','in_app_notification_deliveries','INSERT')
     OR has_table_privilege('nexora_app','in_app_notification_deliveries','DELETE') THEN
    RAISE EXCEPTION 'nexora_app has unsafe INSERT/DELETE privilege on notification deliveries';
  END IF;
  IF NOT has_column_privilege('nexora_app','in_app_notification_deliveries','read_at','UPDATE') THEN
    RAISE EXCEPTION 'nexora_app must be able to update read_at';
  END IF;
  IF has_column_privilege('nexora_app','in_app_notification_deliveries','user_id','UPDATE')
     OR has_column_privilege('nexora_app','in_app_notification_deliveries','notification_event_id','UPDATE')
     OR has_column_privilege('nexora_app','in_app_notification_deliveries','delivered_at','UPDATE') THEN
    RAISE EXCEPTION 'nexora_app can update immutable notification delivery fields';
  END IF;

  IF to_regprocedure('nexora_emit_in_app_notification(text,text,integer,text,text,text,text,text,text,text,text[],jsonb)') IS NULL THEN
    RAISE EXCEPTION 'nexora_emit_in_app_notification function missing';
  END IF;
  IF NOT has_function_privilege(
    'nexora_app',
    'nexora_emit_in_app_notification(text,text,integer,text,text,text,text,text,text,text,text[],jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'nexora_app cannot execute protected notification emitter';
  END IF;

  SELECT count(*)::int INTO v_count
    FROM pg_trigger
   WHERE NOT tgisinternal
     AND tgname IN (
       'in_app_notification_events_immutable',
       'in_app_notification_deliveries_guard_update',
       'transport_requests_emit_in_app_notification',
       'transport_contracts_emit_in_app_notification',
       'trip_status_history_emit_in_app_notification',
       'document_validations_emit_in_app_notification'
     );
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'NEX-54 expected 6 notification/guard triggers, found %', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
     WHERE NOT t.tgisinternal AND t.tgname='transport_requests_emit_in_app_notification' AND c.relname='transport_requests'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
     WHERE NOT t.tgisinternal AND t.tgname='transport_contracts_emit_in_app_notification' AND c.relname='transport_contracts'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
     WHERE NOT t.tgisinternal AND t.tgname='trip_status_history_emit_in_app_notification' AND c.relname='trip_status_history'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
     WHERE NOT t.tgisinternal AND t.tgname='document_validations_emit_in_app_notification' AND c.relname='document_validations'
  ) THEN
    RAISE EXCEPTION 'one or more NEX-54 domain producer triggers are attached to the wrong table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='in_app_notification_events_tenant_event_key_unique'
       AND conrelid='in_app_notification_events'::regclass
  ) THEN
    RAISE EXCEPTION 'notification event deduplication constraint missing';
  END IF;

  RAISE NOTICE 'NEX-54 schema, RLS, least privilege, triggers and dedupe verified';
END;
$$;
