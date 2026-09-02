\set ON_ERROR_STOP on

DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c
    FROM information_schema.tables
   WHERE table_schema='public'
     AND table_name IN ('document_compliance_policies','document_compliance_overrides');
  IF c <> 2 THEN RAISE EXCEPTION 'Expected two NEX-47 compliance tables, found %', c; END IF;

  SELECT count(*) INTO c
    FROM pg_class cl
    JOIN pg_namespace n ON n.oid=cl.relnamespace
   WHERE n.nspname='public'
     AND cl.relname IN ('document_compliance_policies','document_compliance_overrides')
     AND cl.relrowsecurity;
  IF c <> 2 THEN RAISE EXCEPTION 'Expected RLS on both NEX-47 tables, found %', c; END IF;

  IF NOT has_table_privilege('nexora_app','public.document_compliance_policies','SELECT')
     OR NOT has_table_privilege('nexora_app','public.document_compliance_policies','INSERT')
     OR has_table_privilege('nexora_app','public.document_compliance_policies','DELETE') THEN
    RAISE EXCEPTION 'Compliance policy base privileges are incorrect';
  END IF;

  IF has_table_privilege('nexora_app','public.document_compliance_policies','UPDATE') THEN
    RAISE EXCEPTION 'Compliance policy UPDATE must be column-scoped, not table-wide';
  END IF;

  IF NOT has_column_privilege('nexora_app','public.document_compliance_policies','warning_days','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.document_compliance_policies','required_for_contracting','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.document_compliance_policies','required_for_trip','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.document_compliance_policies','block_when_expiring_soon','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.document_compliance_policies','updated_by_user_id','UPDATE')
     OR NOT has_column_privilege('nexora_app','public.document_compliance_policies','updated_at','UPDATE') THEN
    RAISE EXCEPTION 'Compliance policy mutable columns are missing UPDATE privilege';
  END IF;

  IF has_column_privilege('nexora_app','public.document_compliance_policies','tenant_id','UPDATE')
     OR has_column_privilege('nexora_app','public.document_compliance_policies','document_type_id','UPDATE')
     OR has_column_privilege('nexora_app','public.document_compliance_policies','created_by_user_id','UPDATE')
     OR has_column_privilege('nexora_app','public.document_compliance_policies','created_at','UPDATE') THEN
    RAISE EXCEPTION 'Compliance policy identity/audit columns must not be mutable by nexora_app';
  END IF;

  IF NOT has_table_privilege('nexora_app','public.document_compliance_overrides','SELECT')
     OR NOT has_table_privilege('nexora_app','public.document_compliance_overrides','INSERT')
     OR has_table_privilege('nexora_app','public.document_compliance_overrides','UPDATE')
     OR has_table_privilege('nexora_app','public.document_compliance_overrides','DELETE') THEN
    RAISE EXCEPTION 'Compliance override append-only privileges are incorrect';
  END IF;

  IF NOT has_function_privilege('nexora_app','nexora_evaluate_document_compliance(text,uuid,text)','EXECUTE')
     OR NOT has_function_privilege('nexora_app','nexora_assert_document_compliance(text,uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'NEX-47 compliance function privileges are incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='document_compliance_overrides_max_duration_check'
  ) THEN
    RAISE EXCEPTION 'Override maximum duration constraint is missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='transport_contracts_document_compliance_guard' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Contract document compliance trigger is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trips_document_compliance_guard' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Trip document compliance trigger is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trip_drivers_document_compliance_guard' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Active trip driver compliance trigger is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trip_assets_document_compliance_guard' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Active trip asset compliance trigger is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='document_compliance_overrides_guard' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Compliance override subject/policy guard is missing';
  END IF;
END $$;
