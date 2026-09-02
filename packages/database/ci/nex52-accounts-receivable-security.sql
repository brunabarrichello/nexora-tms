\set ON_ERROR_STOP on

DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c
    FROM information_schema.tables
   WHERE table_schema='public'
     AND table_name IN ('customer_receivables','customer_receivable_transactions','customer_receivable_events');
  IF c <> 3 THEN RAISE EXCEPTION 'Expected three NEX-52 receivable tables, found %', c; END IF;

  SELECT count(*) INTO c
    FROM pg_class cl
    JOIN pg_namespace n ON n.oid=cl.relnamespace
   WHERE n.nspname='public'
     AND cl.relname IN ('customer_receivables','customer_receivable_transactions','customer_receivable_events')
     AND cl.relrowsecurity;
  IF c <> 3 THEN RAISE EXCEPTION 'Expected RLS on all NEX-52 receivable tables, found %', c; END IF;

  IF NOT has_table_privilege('nexora_app','public.customer_receivables','SELECT')
     OR NOT has_table_privilege('nexora_app','public.customer_receivables','INSERT')
     OR has_table_privilege('nexora_app','public.customer_receivables','DELETE') THEN
    RAISE EXCEPTION 'Customer receivable base privileges are incorrect';
  END IF;
  IF has_table_privilege('nexora_app','public.customer_receivables','UPDATE') THEN
    RAISE EXCEPTION 'Customer receivable UPDATE must be column-scoped';
  END IF;
  IF NOT has_column_privilege('nexora_app','public.customer_receivables','due_at','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.customer_receivables','fiscal_document_id','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.customer_receivables','fiscal_reference','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.customer_receivables','status','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.customer_receivables','updated_by_user_id','UPDATE') THEN
    RAISE EXCEPTION 'Customer receivable mutable columns are missing UPDATE privilege';
  END IF;
  IF has_column_privilege('nexora_app','public.customer_receivables','tenant_id','UPDATE')
     OR has_column_privilege('nexora_app','public.customer_receivables','transport_request_id','UPDATE')
     OR has_column_privilege('nexora_app','public.customer_receivables','customer_party_id','UPDATE')
     OR has_column_privilege('nexora_app','public.customer_receivables','currency_code','UPDATE')
     OR has_column_privilege('nexora_app','public.customer_receivables','invoiced_amount','UPDATE')
     OR has_column_privilege('nexora_app','public.customer_receivables','created_by_user_id','UPDATE') THEN
    RAISE EXCEPTION 'Customer receivable identity/snapshot columns must be immutable';
  END IF;

  IF NOT has_table_privilege('nexora_app','public.customer_receivable_transactions','SELECT')
     OR NOT has_table_privilege('nexora_app','public.customer_receivable_transactions','INSERT')
     OR has_table_privilege('nexora_app','public.customer_receivable_transactions','UPDATE')
     OR has_table_privilege('nexora_app','public.customer_receivable_transactions','DELETE') THEN
    RAISE EXCEPTION 'Customer receivable transactions must be append-only';
  END IF;
  IF NOT has_table_privilege('nexora_app','public.customer_receivable_events','SELECT')
     OR has_table_privilege('nexora_app','public.customer_receivable_events','INSERT')
     OR has_table_privilege('nexora_app','public.customer_receivable_events','UPDATE')
     OR has_table_privilege('nexora_app','public.customer_receivable_events','DELETE') THEN
    RAISE EXCEPTION 'Customer receivable events privileges are incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname='public' AND indexname='customer_receivable_transactions_single_reversal_idx'
  ) THEN
    RAISE EXCEPTION 'Single receipt reversal unique index is missing';
  END IF;

  SELECT count(*) INTO c
    FROM pg_trigger
   WHERE NOT tgisinternal
     AND tgname IN (
       'customer_receivables_guard',
       'customer_receivable_transactions_guard',
       'customer_receivable_transactions_immutable',
       'customer_receivable_events_immutable',
       'customer_receivables_events',
       'customer_receivable_transactions_events'
     );
  IF c <> 6 THEN RAISE EXCEPTION 'Expected six NEX-52 receivable triggers, found %', c; END IF;

  IF has_function_privilege('public','nexora_customer_receivable_guard()','EXECUTE')
     OR has_function_privilege('public','nexora_customer_receivable_transaction_guard()','EXECUTE')
     OR has_function_privilege('public','nexora_customer_receivable_append_only_guard()','EXECUTE')
     OR has_function_privilege('public','nexora_customer_receivable_events()','EXECUTE')
     OR has_function_privilege('public','nexora_customer_receivable_transaction_events()','EXECUTE') THEN
    RAISE EXCEPTION 'NEX-52 trigger helpers must not be executable by PUBLIC';
  END IF;
END $$;
