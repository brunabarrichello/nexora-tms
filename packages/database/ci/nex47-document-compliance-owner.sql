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
    FROM pg_class cl JOIN pg_namespace n ON n.oid=cl.relnamespace
   WHERE n.nspname='public'
     AND cl.relname IN ('document_compliance_policies','document_compliance_overrides')
     AND cl.relrowsecurity;
  IF c <> 2 THEN RAISE EXCEPTION 'Expected RLS on both NEX-47 tables, found %', c; END IF;

  IF NOT has_table_privilege('nexora_app','public.document_compliance_policies','SELECT')
     OR NOT has_table_privilege('nexora_app','public.document_compliance_policies','INSERT')
     OR NOT has_table_privilege('nexora_app','public.document_compliance_policies','UPDATE')
     OR has_table_privilege('nexora_app','public.document_compliance_policies','DELETE') THEN
    RAISE EXCEPTION 'Compliance policy runtime privileges are incorrect';
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
END $$;

INSERT INTO tenants (id,slug,name) VALUES
  ('77000000-0000-4000-8000-000000000001','nex47-gate-a','NEX-47 Gate A'),
  ('77000000-0000-4000-8000-000000000002','nex47-gate-b','NEX-47 Gate B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id,display_name) VALUES
  ('77000000-0000-4000-8000-000000000101','NEX-47 User A'),
  ('77000000-0000-4000-8000-000000000102','NEX-47 User B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO business_parties (id,tenant_id,tax_id,legal_name) VALUES
  ('77000000-0000-4000-8000-000000000201','77000000-0000-4000-8000-000000000001','NEX47A001','NEX-47 Carrier A'),
  ('77000000-0000-4000-8000-000000000202','77000000-0000-4000-8000-000000000002','NEX47B001','NEX-47 Carrier B')
ON CONFLICT (tenant_id,tax_id) DO NOTHING;

INSERT INTO drivers (
  id,tenant_id,carrier_party_id,full_name,tax_id,phone,cnh_number,cnh_category,cnh_expires_on,
  registration_status,operational_status,created_by_user_id,updated_by_user_id
) VALUES
  ('77000000-0000-4000-8000-000000000301','77000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000201','NEX-47 Driver A','77000000001','11999990001','77000000001','E',current_date+365,'qualified','active','77000000-0000-4000-8000-000000000101','77000000-0000-4000-8000-000000000101'),
  ('77000000-0000-4000-8000-000000000302','77000000-0000-4000-8000-000000000002','77000000-0000-4000-8000-000000000202','NEX-47 Driver B','77000000002','41999990002','77000000002','E',current_date+365,'qualified','active','77000000-0000-4000-8000-000000000102','77000000-0000-4000-8000-000000000102')
ON CONFLICT (id) DO NOTHING;

INSERT INTO capacity_assets (
  id,tenant_id,carrier_party_id,asset_kind,identifier,vehicle_type,body_type,capacity_weight_kg,
  tracking_available,status,created_by_user_id,updated_by_user_id
) VALUES
  ('77000000-0000-4000-8000-000000000401','77000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000201','vehicle','NEX47-ASSET-A','Truck','Sider',18000,true,'active','77000000-0000-4000-8000-000000000101','77000000-0000-4000-8000-000000000101'),
  ('77000000-0000-4000-8000-000000000402','77000000-0000-4000-8000-000000000002','77000000-0000-4000-8000-000000000202','vehicle','NEX47-ASSET-B','Truck','Sider',18000,true,'active','77000000-0000-4000-8000-000000000102','77000000-0000-4000-8000-000000000102')
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_types (id,tenant_id,code,name,subject_scope,has_expiry,requires_validation) VALUES
  ('77000000-0000-4000-8000-000000000501','77000000-0000-4000-8000-000000000001','DRV-LICENSE','Driver License','driver',true,false),
  ('77000000-0000-4000-8000-000000000502','77000000-0000-4000-8000-000000000001','VEH-CERT','Vehicle Certificate','asset',true,false),
  ('77000000-0000-4000-8000-000000000503','77000000-0000-4000-8000-000000000002','DRV-LICENSE','Driver License','driver',true,false)
ON CONFLICT (tenant_id,code) DO NOTHING;

INSERT INTO document_compliance_policies (
  id,tenant_id,document_type_id,required_for_contracting,required_for_trip,warning_days,
  block_when_expiring_soon,created_by_user_id,updated_by_user_id
) VALUES
  ('77000000-0000-4000-8000-000000000601','77000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000501',true,true,30,false,'77000000-0000-4000-8000-000000000101','77000000-0000-4000-8000-000000000101'),
  ('77000000-0000-4000-8000-000000000602','77000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000502',false,true,15,true,'77000000-0000-4000-8000-000000000101','77000000-0000-4000-8000-000000000101'),
  ('77000000-0000-4000-8000-000000000603','77000000-0000-4000-8000-000000000002','77000000-0000-4000-8000-000000000503',true,true,30,false,'77000000-0000-4000-8000-000000000102','77000000-0000-4000-8000-000000000102')
ON CONFLICT (tenant_id,document_type_id) DO NOTHING;

INSERT INTO trips (
  id,tenant_id,code,status,planned_start_at,created_by_user_id,updated_by_user_id
) VALUES (
  '77000000-0000-4000-8000-000000000701','77000000-0000-4000-8000-000000000001','NEX47-TRIP-A','planned',clock_timestamp()+interval '1 day','77000000-0000-4000-8000-000000000101','77000000-0000-4000-8000-000000000101'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO trip_drivers (
  id,tenant_id,trip_id,driver_id,role,starts_at,created_by_user_id,updated_by_user_id
) VALUES (
  '77000000-0000-4000-8000-000000000711','77000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000701','77000000-0000-4000-8000-000000000301','primary',clock_timestamp()+interval '1 day','77000000-0000-4000-8000-000000000101','77000000-0000-4000-8000-000000000101'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO trip_assets (
  id,tenant_id,trip_id,asset_id,role,starts_at,created_by_user_id,updated_by_user_id
) VALUES (
  '77000000-0000-4000-8000-000000000712','77000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000701','77000000-0000-4000-8000-000000000401','vehicle',clock_timestamp()+interval '1 day','77000000-0000-4000-8000-000000000101','77000000-0000-4000-8000-000000000101'
) ON CONFLICT (id) DO NOTHING;
