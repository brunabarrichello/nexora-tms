\set ON_ERROR_STOP on

DO $$
DECLARE
  c integer;
BEGIN
  PERFORM set_config('app.user_id','10000000-0000-4000-8000-000000000101',false);
  PERFORM set_config('app.tenant_id','',false);
  SELECT count(*) INTO c FROM documents;
  IF c <> 0 THEN RAISE EXCEPTION 'No tenant context must expose zero documents, got %', c; END IF;

  PERFORM set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',false);

  INSERT INTO documents (
    id,tenant_id,document_type_id,title,status,issued_on,expires_on,created_by_user_id,updated_by_user_id
  ) VALUES
    ('10000000-0000-4000-8000-000000000301','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000201','Document One','draft','2026-08-30','2027-08-30','10000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000101'),
    ('10000000-0000-4000-8000-000000000302','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000201','Document Two','draft','2026-08-30','2027-08-30','10000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000101');

  INSERT INTO document_versions (
    id,tenant_id,document_id,version_number,original_file_name,mime_type,byte_size,checksum_sha256,storage_provider,storage_key,source,created_by_user_id
  ) VALUES (
    '10000000-0000-4000-8000-000000000401','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000301',1,'doc-one.pdf','application/pdf',128,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','gate','tenant-a/doc-one/v1','upload','10000000-0000-4000-8000-000000000101'
  );

  INSERT INTO document_validations (
    id,tenant_id,document_id,document_version_id,validation_type,result,notes,validated_by_user_id
  ) VALUES (
    '10000000-0000-4000-8000-000000000501','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000301','10000000-0000-4000-8000-000000000401','manual','valid','Gate validation','10000000-0000-4000-8000-000000000101'
  );

  SELECT count(*) INTO c FROM documents;
  IF c <> 2 THEN RAISE EXCEPTION 'Tenant A must see two documents, got %', c; END IF;

  UPDATE documents
     SET deleted_at=now(), deleted_by_user_id='10000000-0000-4000-8000-000000000101', delete_reason='Gate soft delete', updated_by_user_id='10000000-0000-4000-8000-000000000101', updated_at=now()
   WHERE id='10000000-0000-4000-8000-000000000301';

  SELECT count(*) INTO c FROM document_versions WHERE document_id='10000000-0000-4000-8000-000000000301';
  IF c <> 1 THEN RAISE EXCEPTION 'Soft delete must preserve document versions'; END IF;
  SELECT count(*) INTO c FROM document_validations WHERE document_id='10000000-0000-4000-8000-000000000301';
  IF c <> 1 THEN RAISE EXCEPTION 'Soft delete must preserve document validations'; END IF;

  BEGIN
    EXECUTE $$UPDATE document_versions SET source='import' WHERE id='10000000-0000-4000-8000-000000000401'$$;
    RAISE EXCEPTION 'document_versions must reject UPDATE for nexora_app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    EXECUTE $$UPDATE document_validations SET notes='mutated' WHERE id='10000000-0000-4000-8000-000000000501'$$;
    RAISE EXCEPTION 'document_validations must reject UPDATE for nexora_app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO document_validations (
      id,tenant_id,document_id,document_version_id,validation_type,result,validated_by_user_id
    ) VALUES (
      '10000000-0000-4000-8000-000000000502','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000302','10000000-0000-4000-8000-000000000401','manual','valid','10000000-0000-4000-8000-000000000101'
    );
    RAISE EXCEPTION 'Validation must not reference a version from another document';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO documents (
      id,tenant_id,document_type_id,title,created_by_user_id,updated_by_user_id
    ) VALUES (
      '10000000-0000-4000-8000-000000000303','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000202','Cross tenant type','10000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000101'
    );
    RAISE EXCEPTION 'Cross-tenant document type FK must be rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  PERFORM set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',false);
  SELECT count(*) INTO c FROM documents;
  IF c <> 0 THEN RAISE EXCEPTION 'Tenant B must not see Tenant A documents, got %', c; END IF;
END $$;
