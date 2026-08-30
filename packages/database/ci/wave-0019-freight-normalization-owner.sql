\set ON_ERROR_STOP on

DO $block$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c
    FROM information_schema.tables
   WHERE table_schema='public'
     AND table_name IN (
       'transport_request_items','transport_request_packages','transport_request_requirements',
       'transport_request_references','transport_request_status_history','transport_request_events','freight_lanes'
     );
  IF c <> 7 THEN
    RAISE EXCEPTION 'Expected seven Wave 0019 freight normalization tables, found %', c;
  END IF;

  SELECT count(*) INTO c
    FROM pg_class cl
    JOIN pg_namespace n ON n.oid=cl.relnamespace
   WHERE n.nspname='public'
     AND cl.relname IN (
       'transport_request_items','transport_request_packages','transport_request_requirements',
       'transport_request_references','transport_request_status_history','transport_request_events','freight_lanes'
     )
     AND cl.relrowsecurity;
  IF c <> 7 THEN
    RAISE EXCEPTION 'Expected RLS on seven Wave 0019 tables, found %', c;
  END IF;

  SELECT count(*) INTO c FROM drizzle.__drizzle_migrations;
  IF c <> 20 THEN
    RAISE EXCEPTION 'Expected 20 Drizzle migrations after Wave 0019, found %', c;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_class cl
      JOIN pg_namespace n ON n.oid=cl.relnamespace
      JOIN pg_roles r ON r.oid=cl.relowner
     WHERE n.nspname='public'
       AND cl.relname IN (
         'transport_request_items','transport_request_packages','transport_request_requirements',
         'transport_request_references','transport_request_status_history','transport_request_events','freight_lanes'
       )
       AND r.rolname='nexora_app'
  ) THEN
    RAISE EXCEPTION 'nexora_app must not own Wave 0019 tables';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(ARRAY[
        'transport_request_items','transport_request_packages',
        'transport_request_requirements','transport_request_references'
      ]) AS t(table_name)
     WHERE NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'SELECT')
        OR NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'INSERT')
        OR NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'UPDATE')
        OR NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'DELETE')
  ) THEN
    RAISE EXCEPTION 'Wave 0019 mutable request collection privilege matrix is incorrect';
  END IF;

  IF NOT has_table_privilege('nexora_app','public.freight_lanes','SELECT')
     OR NOT has_table_privilege('nexora_app','public.freight_lanes','INSERT')
     OR NOT has_table_privilege('nexora_app','public.freight_lanes','UPDATE')
     OR has_table_privilege('nexora_app','public.freight_lanes','DELETE') THEN
    RAISE EXCEPTION 'freight_lanes runtime privilege matrix is incorrect';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(ARRAY['transport_request_status_history','transport_request_events']) AS t(table_name)
     WHERE NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'SELECT')
        OR NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'INSERT')
        OR has_table_privilege('nexora_app', format('public.%I', table_name), 'UPDATE')
        OR has_table_privilege('nexora_app', format('public.%I', table_name), 'DELETE')
  ) THEN
    RAISE EXCEPTION 'Wave 0019 append-only privilege matrix is incorrect';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transport_request_packages_item_fk') THEN
    RAISE EXCEPTION 'transport_request_packages_item_fk is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transport_request_items_request_fk') THEN
    RAISE EXCEPTION 'transport_request_items_request_fk is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transport_request_requirements_request_fk') THEN
    RAISE EXCEPTION 'transport_request_requirements_request_fk is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transport_request_status_history_request_fk') THEN
    RAISE EXCEPTION 'transport_request_status_history_request_fk is missing';
  END IF;
END
$block$;

INSERT INTO tenants (id, slug, name) VALUES
  ('19000000-0000-4000-8000-000000000001','freight-19-gate-a','Freight 0019 Gate A'),
  ('19000000-0000-4000-8000-000000000002','freight-19-gate-b','Freight 0019 Gate B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, display_name) VALUES
  ('19000000-0000-4000-8000-000000000101','Freight Gate User A'),
  ('19000000-0000-4000-8000-000000000102','Freight Gate User B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO countries (id, code, iso3, numeric_code, name) VALUES
  ('19000000-0000-4000-8000-000000000901','QZ','QZZ','998','Wave 0019 Testland')
ON CONFLICT (id) DO NOTHING;

INSERT INTO states (id, country_id, code, name) VALUES
  ('19000000-0000-4000-8000-000000000911','19000000-0000-4000-8000-000000000901','Q1','Wave 0019 Origin State'),
  ('19000000-0000-4000-8000-000000000912','19000000-0000-4000-8000-000000000901','Q2','Wave 0019 Destination State')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cities (id, state_id, name) VALUES
  ('19000000-0000-4000-8000-000000000921','19000000-0000-4000-8000-000000000911','Wave 0019 Origin City'),
  ('19000000-0000-4000-8000-000000000922','19000000-0000-4000-8000-000000000912','Wave 0019 Destination City')
ON CONFLICT (id) DO NOTHING;

INSERT INTO business_parties (id, tenant_id, tax_id, legal_name) VALUES
  ('19000000-0000-4000-8000-000000000201','19000000-0000-4000-8000-000000000001','190000000001','Wave 0019 Shipper'),
  ('19000000-0000-4000-8000-000000000202','19000000-0000-4000-8000-000000000001','190000000002','Wave 0019 Consignee')
ON CONFLICT (id) DO NOTHING;

INSERT INTO business_party_addresses (
  id, tenant_id, party_id, type, label, street, city, state, country_code
) VALUES
  ('19000000-0000-4000-8000-000000000301','19000000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000201','pickup','Origin','Rua Origem','Origem','SP','BR'),
  ('19000000-0000-4000-8000-000000000302','19000000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000202','delivery','Destination','Rua Destino','Destino','PR','BR')
ON CONFLICT (id) DO NOTHING;

INSERT INTO transport_requests (
  id, tenant_id, customer_party_id, shipper_party_id, consignee_party_id,
  origin_address_id, destination_address_id, planned_pickup_at, planned_delivery_at,
  cargo_description, status, created_by_user_id, updated_by_user_id
) VALUES (
  '19000000-0000-4000-8000-000000000401','19000000-0000-4000-8000-000000000001',
  '19000000-0000-4000-8000-000000000201','19000000-0000-4000-8000-000000000201','19000000-0000-4000-8000-000000000202',
  '19000000-0000-4000-8000-000000000301','19000000-0000-4000-8000-000000000302',
  '2026-08-30T12:00:00Z','2026-08-31T12:00:00Z','Wave 0019 normalized freight gate','draft',
  '19000000-0000-4000-8000-000000000101','19000000-0000-4000-8000-000000000101'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cargo_types (id, tenant_id, code, name) VALUES
  ('19000000-0000-4000-8000-000000000502','19000000-0000-4000-8000-000000000002','CROSS-19','Cross Tenant Cargo Type')
ON CONFLICT (id) DO NOTHING;
