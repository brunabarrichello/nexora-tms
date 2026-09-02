\set ON_ERROR_STOP on

DO $$
DECLARE
  c integer;
  v_state text;
  v_blocking boolean;
  v_override uuid;
BEGIN
  PERFORM set_config('app.user_id','77000000-0000-4000-8000-000000000101',false);
  PERFORM set_config('app.tenant_id','',false);
  SELECT count(*) INTO c FROM document_compliance_policies;
  IF c <> 0 THEN RAISE EXCEPTION 'No tenant context must expose zero compliance policies, got %', c; END IF;

  PERFORM set_config('app.tenant_id','77000000-0000-4000-8000-000000000001',false);

  SELECT state,blocking INTO v_state,v_blocking
    FROM nexora_evaluate_document_compliance(
      'driver','77000000-0000-4000-8000-000000000301','contracting'
    )
   WHERE document_type_id='77000000-0000-4000-8000-000000000501';
  IF v_state <> 'missing' OR NOT v_blocking THEN
    RAISE EXCEPTION 'Missing required driver document must block contracting, got state=% blocking=%', v_state,v_blocking;
  END IF;

  BEGIN
    PERFORM nexora_assert_document_compliance(
      'driver','77000000-0000-4000-8000-000000000301','contracting'
    );
    RAISE EXCEPTION 'Missing required driver document must raise compliance block';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;

  INSERT INTO documents (
    id,tenant_id,document_type_id,title,status,issued_on,expires_on,created_by_user_id,updated_by_user_id
  ) VALUES (
    '77000000-0000-4000-8000-000000000801','77000000-0000-4000-8000-000000000001',
    '77000000-0000-4000-8000-000000000501','Driver License A','valid',current_date-10,current_date+10,
    '77000000-0000-4000-8000-000000000101','77000000-0000-4000-8000-000000000101'
  );

  INSERT INTO driver_documents (
    id,tenant_id,driver_id,document_id,document_type_id,issued_on,expires_on,status,validation_status,
    created_by_user_id,updated_by_user_id
  ) VALUES (
    '77000000-0000-4000-8000-000000000811','77000000-0000-4000-8000-000000000001',
    '77000000-0000-4000-8000-000000000301','77000000-0000-4000-8000-000000000801',
    '77000000-0000-4000-8000-000000000501',current_date-10,current_date+10,'valid','not_required',
    '77000000-0000-4000-8000-000000000101','77000000-0000-4000-8000-000000000101'
  );

  SELECT state,blocking INTO v_state,v_blocking
    FROM nexora_evaluate_document_compliance(
      'driver','77000000-0000-4000-8000-000000000301','contracting'
    )
   WHERE document_type_id='77000000-0000-4000-8000-000000000501';
  IF v_state <> 'expiring_soon' OR v_blocking THEN
    RAISE EXCEPTION 'Document inside warning window must be expiring_soon and initially non-blocking, got state=% blocking=%',v_state,v_blocking;
  END IF;

  UPDATE document_compliance_policies
     SET block_when_expiring_soon=true,
         updated_by_user_id='77000000-0000-4000-8000-000000000101',updated_at=now()
   WHERE document_type_id='77000000-0000-4000-8000-000000000501';

  SELECT blocking INTO v_blocking
    FROM nexora_evaluate_document_compliance(
      'driver','77000000-0000-4000-8000-000000000301','contracting'
    )
   WHERE document_type_id='77000000-0000-4000-8000-000000000501';
  IF NOT v_blocking THEN RAISE EXCEPTION 'Policy must be able to block expiring-soon documents'; END IF;

  INSERT INTO document_compliance_overrides (
    id,tenant_id,context,subject_scope,subject_id,document_type_id,reason,valid_until,created_by_user_id
  ) VALUES (
    '77000000-0000-4000-8000-000000000901','77000000-0000-4000-8000-000000000001','contracting','driver',
    '77000000-0000-4000-8000-000000000301','77000000-0000-4000-8000-000000000501',
    'Gate-approved temporary contracting exception',clock_timestamp()+interval '1 day','77000000-0000-4000-8000-000000000101'
  );

  SELECT blocking,override_id INTO v_blocking,v_override
    FROM nexora_evaluate_document_compliance(
      'driver','77000000-0000-4000-8000-000000000301','contracting'
    )
   WHERE document_type_id='77000000-0000-4000-8000-000000000501';
  IF v_blocking OR v_override <> '77000000-0000-4000-8000-000000000901'::uuid THEN
    RAISE EXCEPTION 'Active administrative override must make the finding non-blocking';
  END IF;

  BEGIN
    UPDATE document_compliance_overrides
       SET reason='Illegal mutation attempt'
     WHERE id='77000000-0000-4000-8000-000000000901';
    RAISE EXCEPTION 'Compliance overrides must reject UPDATE for nexora_app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  UPDATE document_compliance_policies
     SET block_when_expiring_soon=false,
         updated_by_user_id='77000000-0000-4000-8000-000000000101',updated_at=now()
   WHERE document_type_id='77000000-0000-4000-8000-000000000501';

  BEGIN
    UPDATE trips SET status='ready',updated_at=now()
     WHERE id='77000000-0000-4000-8000-000000000701';
    RAISE EXCEPTION 'Trip ready transition must be blocked while required asset document is missing';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;

  SELECT status::text INTO v_state FROM trips WHERE id='77000000-0000-4000-8000-000000000701';
  IF v_state <> 'planned' THEN RAISE EXCEPTION 'Blocked trip transition must preserve planned status'; END IF;

  INSERT INTO document_compliance_overrides (
    id,tenant_id,context,subject_scope,subject_id,document_type_id,reason,valid_until,created_by_user_id
  ) VALUES (
    '77000000-0000-4000-8000-000000000902','77000000-0000-4000-8000-000000000001','trip','asset',
    '77000000-0000-4000-8000-000000000401','77000000-0000-4000-8000-000000000502',
    'Gate-approved temporary trip exception for missing asset certificate',clock_timestamp()+interval '1 day','77000000-0000-4000-8000-000000000101'
  );

  UPDATE trips SET status='ready',updated_at=now()
   WHERE id='77000000-0000-4000-8000-000000000701';
  SELECT status::text INTO v_state FROM trips WHERE id='77000000-0000-4000-8000-000000000701';
  IF v_state <> 'ready' THEN RAISE EXCEPTION 'Active trip override must permit ready transition'; END IF;

  PERFORM set_config('app.user_id','77000000-0000-4000-8000-000000000102',false);
  PERFORM set_config('app.tenant_id','77000000-0000-4000-8000-000000000002',false);
  SELECT count(*) INTO c FROM document_compliance_policies;
  IF c <> 1 THEN RAISE EXCEPTION 'Tenant B must see exactly its own policy, got %', c; END IF;
  SELECT count(*) INTO c FROM document_compliance_overrides;
  IF c <> 0 THEN RAISE EXCEPTION 'Tenant B must not see Tenant A overrides, got %', c; END IF;

  BEGIN
    INSERT INTO document_compliance_overrides (
      tenant_id,context,subject_scope,subject_id,document_type_id,reason,valid_until,created_by_user_id
    ) VALUES (
      '77000000-0000-4000-8000-000000000001','trip','driver','77000000-0000-4000-8000-000000000301',
      '77000000-0000-4000-8000-000000000501','Cross-tenant override must fail',clock_timestamp()+interval '1 day',
      '77000000-0000-4000-8000-000000000102'
    );
    RAISE EXCEPTION USING
      ERRCODE='N4701',
      MESSAGE='Cross-tenant compliance override was not rejected';
  EXCEPTION
    WHEN insufficient_privilege OR SQLSTATE 'P0001' THEN NULL;
  END;
END $$;
