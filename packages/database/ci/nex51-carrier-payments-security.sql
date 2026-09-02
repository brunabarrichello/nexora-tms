\set ON_ERROR_STOP on

DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c
    FROM information_schema.tables
   WHERE table_schema='public'
     AND table_name IN (
       'carrier_payment_obligations','carrier_payment_transactions','carrier_payment_events'
     );
  IF c <> 3 THEN RAISE EXCEPTION 'Expected three NEX-51 finance tables, found %', c; END IF;

  SELECT count(*) INTO c
    FROM pg_class cl
    JOIN pg_namespace n ON n.oid=cl.relnamespace
   WHERE n.nspname='public'
     AND cl.relname IN (
       'carrier_payment_obligations','carrier_payment_transactions','carrier_payment_events'
     )
     AND cl.relrowsecurity;
  IF c <> 3 THEN RAISE EXCEPTION 'Expected RLS on all NEX-51 finance tables, found %', c; END IF;

  IF NOT has_table_privilege('nexora_app','public.carrier_payment_obligations','SELECT')
     OR NOT has_table_privilege('nexora_app','public.carrier_payment_obligations','INSERT')
     OR has_table_privilege('nexora_app','public.carrier_payment_obligations','DELETE') THEN
    RAISE EXCEPTION 'Carrier payment obligation base privileges are incorrect';
  END IF;

  IF has_table_privilege('nexora_app','public.carrier_payment_obligations','UPDATE') THEN
    RAISE EXCEPTION 'Carrier payment obligation UPDATE must be column-scoped';
  END IF;

  IF NOT has_column_privilege('nexora_app','public.carrier_payment_obligations','due_at','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.carrier_payment_obligations','trip_id','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.carrier_payment_obligations','notes','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.carrier_payment_obligations','status','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.carrier_payment_obligations','updated_by_user_id','UPDATE') THEN
    RAISE EXCEPTION 'Carrier payment obligation mutable columns are missing UPDATE privilege';
  END IF;

  IF has_column_privilege('nexora_app','public.carrier_payment_obligations','tenant_id','UPDATE')
     OR has_column_privilege('nexora_app','public.carrier_payment_obligations','transport_contract_id','UPDATE')
     OR has_column_privilege('nexora_app','public.carrier_payment_obligations','carrier_party_id','UPDATE')
     OR has_column_privilege('nexora_app','public.carrier_payment_obligations','currency_code','UPDATE')
     OR has_column_privilege('nexora_app','public.carrier_payment_obligations','contracted_amount','UPDATE')
     OR has_column_privilege('nexora_app','public.carrier_payment_obligations','created_by_user_id','UPDATE') THEN
    RAISE EXCEPTION 'Carrier payment obligation identity/snapshot columns must be immutable';
  END IF;

  IF NOT has_table_privilege('nexora_app','public.carrier_payment_transactions','SELECT')
     OR NOT has_table_privilege('nexora_app','public.carrier_payment_transactions','INSERT')
     OR has_table_privilege('nexora_app','public.carrier_payment_transactions','UPDATE')
     OR has_table_privilege('nexora_app','public.carrier_payment_transactions','DELETE') THEN
    RAISE EXCEPTION 'Carrier payment transaction append-only privileges are incorrect';
  END IF;

  IF NOT has_table_privilege('nexora_app','public.carrier_payment_events','SELECT')
     OR has_table_privilege('nexora_app','public.carrier_payment_events','INSERT')
     OR has_table_privilege('nexora_app','public.carrier_payment_events','UPDATE')
     OR has_table_privilege('nexora_app','public.carrier_payment_events','DELETE') THEN
    RAISE EXCEPTION 'Carrier payment event append-only privileges are incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname='public'
       AND indexname='carrier_payment_transactions_single_reversal_idx'
  ) THEN
    RAISE EXCEPTION 'Single reversal unique index is missing';
  END IF;

  SELECT count(*) INTO c
    FROM pg_trigger
   WHERE NOT tgisinternal
     AND tgname IN (
       'carrier_payment_obligations_guard',
       'carrier_payment_transactions_guard',
       'carrier_payment_transactions_immutable',
       'carrier_payment_events_immutable',
       'carrier_payment_obligations_events',
       'carrier_payment_transactions_events'
     );
  IF c <> 6 THEN RAISE EXCEPTION 'Expected six NEX-51 finance triggers, found %', c; END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
     WHERE n.nspname='public'
       AND p.proname IN (
         'nexora_carrier_payment_obligation_guard',
         'nexora_carrier_payment_transaction_guard',
         'nexora_carrier_payment_events_guard',
         'nexora_carrier_payment_obligation_events',
         'nexora_carrier_payment_transaction_events'
       )
       AND acl.grantee=0
       AND acl.privilege_type='EXECUTE'
  ) THEN
    RAISE EXCEPTION 'NEX-51 trigger helpers must not be executable by PUBLIC';
  END IF;
END $$;
