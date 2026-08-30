\set ON_ERROR_STOP on

DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c
    FROM information_schema.tables
   WHERE table_schema='public'
     AND table_name IN ('documents','document_versions','document_validations','business_party_documents','transport_request_documents');
  IF c <> 5 THEN
    RAISE EXCEPTION 'Expected five Wave 0018 document tables, found %', c;
  END IF;

  SELECT count(*) INTO c
    FROM pg_class cl
    JOIN pg_namespace n ON n.oid=cl.relnamespace
   WHERE n.nspname='public'
     AND cl.relname IN ('documents','document_versions','document_validations','business_party_documents','transport_request_documents')
     AND cl.relrowsecurity;
  IF c <> 5 THEN
    RAISE EXCEPTION 'Expected RLS on five Wave 0018 document tables, found %', c;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='driver_documents_document_fk') THEN
    RAISE EXCEPTION 'driver_documents_document_fk is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='capacity_asset_documents_document_fk') THEN
    RAISE EXCEPTION 'capacity_asset_documents_document_fk is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='driver_documents_tenant_document_unique') THEN
    RAISE EXCEPTION 'driver document canonical unique index is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='capacity_asset_documents_tenant_document_unique') THEN
    RAISE EXCEPTION 'asset document canonical unique index is missing';
  END IF;

  IF NOT has_table_privilege('nexora_app','public.documents','SELECT')
     OR NOT has_table_privilege('nexora_app','public.documents','INSERT')
     OR NOT has_table_privilege('nexora_app','public.documents','UPDATE')
     OR has_table_privilege('nexora_app','public.documents','DELETE') THEN
    RAISE EXCEPTION 'documents runtime privilege matrix is incorrect';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(ARRAY['document_versions','document_validations','business_party_documents','transport_request_documents']) AS t(table_name)
     WHERE NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'SELECT')
        OR NOT has_table_privilege('nexora_app', format('public.%I', table_name), 'INSERT')
        OR has_table_privilege('nexora_app', format('public.%I', table_name), 'UPDATE')
        OR has_table_privilege('nexora_app', format('public.%I', table_name), 'DELETE')
  ) THEN
    RAISE EXCEPTION 'document append-only runtime privilege matrix is incorrect';
  END IF;
END $$;

INSERT INTO tenants (id, slug, name) VALUES
  ('10000000-0000-4000-8000-000000000001','doc-gate-a','Document Gate A'),
  ('10000000-0000-4000-8000-000000000002','doc-gate-b','Document Gate B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, display_name) VALUES
  ('10000000-0000-4000-8000-000000000101','Document Gate User A'),
  ('10000000-0000-4000-8000-000000000102','Document Gate User B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_types (id, tenant_id, code, name, subject_scope, has_expiry, requires_validation) VALUES
  ('10000000-0000-4000-8000-000000000201','10000000-0000-4000-8000-000000000001','DOC-A','Gate Document A','other',true,true),
  ('10000000-0000-4000-8000-000000000202','10000000-0000-4000-8000-000000000002','DOC-B','Gate Document B','other',true,true)
ON CONFLICT (tenant_id, code) DO NOTHING;
