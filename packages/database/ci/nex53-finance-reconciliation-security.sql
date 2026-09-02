DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'financial_reconciliation_imports',
    'financial_reconciliation_entries',
    'financial_reconciliation_matches',
    'financial_reconciliation_events'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      RAISE EXCEPTION 'missing NEX-53 table: %', v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v_table AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled on %', v_table;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('nexora_app','financial_reconciliation_imports','SELECT')
     OR NOT has_table_privilege('nexora_app','financial_reconciliation_imports','INSERT')
     OR has_table_privilege('nexora_app','financial_reconciliation_imports','UPDATE')
     OR has_table_privilege('nexora_app','financial_reconciliation_imports','DELETE') THEN
    RAISE EXCEPTION 'invalid nexora_app privileges on reconciliation imports';
  END IF;

  IF NOT has_table_privilege('nexora_app','financial_reconciliation_entries','SELECT')
     OR NOT has_table_privilege('nexora_app','financial_reconciliation_entries','INSERT')
     OR has_table_privilege('nexora_app','financial_reconciliation_entries','DELETE') THEN
    RAISE EXCEPTION 'invalid nexora_app base privileges on reconciliation entries';
  END IF;

  IF NOT has_column_privilege('nexora_app','financial_reconciliation_entries','status','UPDATE')
     OR has_column_privilege('nexora_app','financial_reconciliation_entries','amount','UPDATE')
     OR has_column_privilege('nexora_app','financial_reconciliation_entries','reference','UPDATE') THEN
    RAISE EXCEPTION 'reconciliation entry mutable columns are not least-privilege';
  END IF;

  IF NOT has_table_privilege('nexora_app','financial_reconciliation_matches','SELECT')
     OR NOT has_table_privilege('nexora_app','financial_reconciliation_matches','INSERT')
     OR has_table_privilege('nexora_app','financial_reconciliation_matches','DELETE') THEN
    RAISE EXCEPTION 'invalid nexora_app base privileges on reconciliation matches';
  END IF;

  IF NOT has_column_privilege('nexora_app','financial_reconciliation_matches','status','UPDATE')
     OR has_column_privilege('nexora_app','financial_reconciliation_matches','target_id','UPDATE')
     OR has_column_privilege('nexora_app','financial_reconciliation_matches','ledger_transaction_id','UPDATE') THEN
    RAISE EXCEPTION 'reconciliation match mutable columns are not least-privilege';
  END IF;

  IF NOT has_table_privilege('nexora_app','financial_reconciliation_events','SELECT')
     OR has_table_privilege('nexora_app','financial_reconciliation_events','INSERT')
     OR has_table_privilege('nexora_app','financial_reconciliation_events','UPDATE')
     OR has_table_privilege('nexora_app','financial_reconciliation_events','DELETE') THEN
    RAISE EXCEPTION 'reconciliation events must be read-only to nexora_app';
  END IF;

  IF NOT has_function_privilege(
    'nexora_app',
    'nexora_record_finance_reconciliation_event(uuid,uuid,character varying,jsonb,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'nexora_app cannot call protected reconciliation audit function';
  END IF;

  IF has_function_privilege(
    'public',
    'nexora_record_finance_reconciliation_event(uuid,uuid,character varying,jsonb,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC must not execute reconciliation audit function';
  END IF;

  IF (
    SELECT count(*)
      FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
     WHERE c.relname IN (
       'financial_reconciliation_imports',
       'financial_reconciliation_entries',
       'financial_reconciliation_matches',
       'financial_reconciliation_events'
     )
       AND NOT t.tgisinternal
  ) < 4 THEN
    RAISE EXCEPTION 'NEX-53 reconciliation guards are incomplete';
  END IF;
END
$$;
