\set ON_ERROR_STOP on

DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c
    FROM information_schema.tables
   WHERE table_schema='public'
     AND table_name IN (
       'matching_rules',
       'matching_preferences',
       'matching_runs',
       'matching_candidates',
       'matching_candidate_scores',
       'matching_rule_results',
       'matching_rejections'
     );
  IF c <> 7 THEN
    RAISE EXCEPTION 'Expected seven Wave 0020 matching tables, found %', c;
  END IF;

  SELECT count(*) INTO c
    FROM pg_class cl
    JOIN pg_namespace n ON n.oid=cl.relnamespace
   WHERE n.nspname='public'
     AND cl.relname IN (
       'matching_rules',
       'matching_preferences',
       'matching_runs',
       'matching_candidates',
       'matching_candidate_scores',
       'matching_rule_results',
       'matching_rejections'
     )
     AND cl.relrowsecurity;
  IF c <> 7 THEN
    RAISE EXCEPTION 'Expected RLS on seven Wave 0020 matching tables, found %', c;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(ARRAY['matching_rules','matching_preferences','matching_runs']) AS t(table_name)
     WHERE NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'SELECT')
        OR NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'INSERT')
        OR NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'UPDATE')
        OR has_table_privilege('nexora_app', format('public.%I', table_name), 'DELETE')
  ) THEN
    RAISE EXCEPTION 'Matching mutable runtime privilege matrix is incorrect';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(ARRAY['matching_candidates','matching_candidate_scores','matching_rule_results','matching_rejections']) AS t(table_name)
     WHERE NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'SELECT')
        OR NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'INSERT')
        OR has_table_privilege('nexora_app', format('public.%I', table_name), 'UPDATE')
        OR has_table_privilege('nexora_app', format('public.%I', table_name), 'DELETE')
  ) THEN
    RAISE EXCEPTION 'Matching append-only runtime privilege matrix is incorrect';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='matching_runs_transport_request_fk') THEN
    RAISE EXCEPTION 'matching_runs_transport_request_fk is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='matching_candidates_assignment_fk') THEN
    RAISE EXCEPTION 'matching_candidates_assignment_fk is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='matching_rule_results_rule_fk') THEN
    RAISE EXCEPTION 'matching_rule_results_rule_fk is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='matching_rejections_rule_result_fk') THEN
    RAISE EXCEPTION 'matching_rejections_rule_result_fk is missing';
  END IF;
END $$;

INSERT INTO tenants (id, slug, name) VALUES
  ('20000000-0000-4000-8000-000000000001','matching-gate-a','Matching Gate A'),
  ('20000000-0000-4000-8000-000000000002','matching-gate-b','Matching Gate B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, display_name) VALUES
  ('20000000-0000-4000-8000-000000000101','Matching Gate User A'),
  ('20000000-0000-4000-8000-000000000102','Matching Gate User B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO business_parties (id, tenant_id, tax_id, legal_name) VALUES
  ('20000000-0000-4000-8000-000000000201','20000000-0000-4000-8000-000000000001','MATCHA001','Matching Carrier A'),
  ('20000000-0000-4000-8000-000000000202','20000000-0000-4000-8000-000000000002','MATCHB001','Matching Carrier B')
ON CONFLICT (tenant_id, tax_id) DO NOTHING;

INSERT INTO business_party_addresses (
  id, tenant_id, party_id, type, label, street, city, state
) VALUES
  ('20000000-0000-4000-8000-000000000211','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000201','pickup','Origin A','Rua Origem A','Sao Paulo','SP'),
  ('20000000-0000-4000-8000-000000000212','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000201','delivery','Destination A','Rua Destino A','Campinas','SP'),
  ('20000000-0000-4000-8000-000000000213','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000202','pickup','Origin B','Rua Origem B','Curitiba','PR'),
  ('20000000-0000-4000-8000-000000000214','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000202','delivery','Destination B','Rua Destino B','Londrina','PR')
ON CONFLICT DO NOTHING;

INSERT INTO transport_requests (
  id, tenant_id, customer_party_id, shipper_party_id, consignee_party_id,
  origin_address_id, destination_address_id, planned_pickup_at, planned_delivery_at,
  cargo_description, status, created_by_user_id, updated_by_user_id
) VALUES
  ('20000000-0000-4000-8000-000000000301','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000201','20000000-0000-4000-8000-000000000201','20000000-0000-4000-8000-000000000201','20000000-0000-4000-8000-000000000211','20000000-0000-4000-8000-000000000212','2026-09-01T10:00:00Z','2026-09-02T10:00:00Z','Matching gate cargo A','ready_for_quote','20000000-0000-4000-8000-000000000101','20000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000302','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000202','20000000-0000-4000-8000-000000000202','20000000-0000-4000-8000-000000000202','20000000-0000-4000-8000-000000000213','20000000-0000-4000-8000-000000000214','2026-09-01T10:00:00Z','2026-09-02T10:00:00Z','Matching gate cargo B','ready_for_quote','20000000-0000-4000-8000-000000000102','20000000-0000-4000-8000-000000000102')
ON CONFLICT (id) DO NOTHING;

INSERT INTO drivers (
  id, tenant_id, carrier_party_id, full_name, tax_id, phone, cnh_number, cnh_category,
  cnh_expires_on, registration_status, operational_status, created_by_user_id, updated_by_user_id
) VALUES
  ('20000000-0000-4000-8000-000000000401','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000201','Driver Gate A','11111111111','11999999999','11111111111','E','2028-12-31','qualified','active','20000000-0000-4000-8000-000000000101','20000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000402','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000202','Driver Gate B','22222222222','41999999999','22222222222','E','2028-12-31','qualified','active','20000000-0000-4000-8000-000000000102','20000000-0000-4000-8000-000000000102')
ON CONFLICT (id) DO NOTHING;

INSERT INTO capacity_assets (
  id, tenant_id, carrier_party_id, asset_kind, identifier, vehicle_type, body_type,
  capacity_weight_kg, tracking_available, status, created_by_user_id, updated_by_user_id
) VALUES
  ('20000000-0000-4000-8000-000000000501','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000201','vehicle','MATCH-ASSET-A','Truck','Sider',20000,true,'active','20000000-0000-4000-8000-000000000101','20000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000502','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000202','vehicle','MATCH-ASSET-B','Truck','Sider',20000,true,'active','20000000-0000-4000-8000-000000000102','20000000-0000-4000-8000-000000000102')
ON CONFLICT (id) DO NOTHING;

INSERT INTO capacity_assignments (
  id, tenant_id, driver_id, vehicle_id, carrier_party_id, status,
  created_by_user_id, updated_by_user_id
) VALUES
  ('20000000-0000-4000-8000-000000000601','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000401','20000000-0000-4000-8000-000000000501','20000000-0000-4000-8000-000000000201','active','20000000-0000-4000-8000-000000000101','20000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000602','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000402','20000000-0000-4000-8000-000000000502','20000000-0000-4000-8000-000000000202','active','20000000-0000-4000-8000-000000000102','20000000-0000-4000-8000-000000000102')
ON CONFLICT (id) DO NOTHING;
