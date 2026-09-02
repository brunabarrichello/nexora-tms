DO $block$
DECLARE
  v_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='compliance_risk_assessments'
  ) THEN
    RAISE EXCEPTION 'compliance_risk_assessments table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='compliance_risk_assessments' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on compliance_risk_assessments';
  END IF;

  IF NOT has_table_privilege('nexora_app','public.compliance_risk_assessments','SELECT')
     OR NOT has_table_privilege('nexora_app','public.compliance_risk_assessments','INSERT')
     OR has_table_privilege('nexora_app','public.compliance_risk_assessments','UPDATE')
     OR has_table_privilege('nexora_app','public.compliance_risk_assessments','DELETE') THEN
    RAISE EXCEPTION 'compliance risk least-privilege grants are incorrect';
  END IF;

  SELECT count(*) INTO v_count
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public'
     AND c.relname='compliance_risk_assessments'
     AND NOT t.tgisinternal
     AND t.tgname IN (
       'compliance_risk_assessments_subject_guard',
       'compliance_risk_assessments_immutable',
       'compliance_risk_assessments_audit'
     );
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Expected 3 NEX-49 assessment triggers, found %', v_count;
  END IF;
END
$block$;

INSERT INTO tenants (id,slug,name) VALUES
  ('75000000-0000-4000-8000-000000000001','nex49-a','NEX-49 Tenant A'),
  ('75000000-0000-4000-8000-000000000002','nex49-b','NEX-49 Tenant B');

INSERT INTO users (id,display_name) VALUES
  ('75000000-0000-4000-8000-000000000101','NEX-49 User A'),
  ('75000000-0000-4000-8000-000000000102','NEX-49 User B');

INSERT INTO business_parties (
  id,tenant_id,tax_id,legal_name,email,phone,status,homologation_status
) VALUES (
  '75000000-0000-4000-8000-000000000201',
  '75000000-0000-4000-8000-000000000001',
  '12345678000190','NEX-49 Carrier A','risk-a@nexora.test','11999990000','active','pending'
);

INSERT INTO business_party_roles (tenant_id,party_id,role) VALUES (
  '75000000-0000-4000-8000-000000000001',
  '75000000-0000-4000-8000-000000000201',
  'carrier'
);

INSERT INTO drivers (
  id,tenant_id,carrier_party_id,full_name,tax_id,email,phone,cnh_number,cnh_category,cnh_expires_on,
  registration_status,operational_status,status_reason,created_by_user_id,updated_by_user_id
) VALUES (
  '75000000-0000-4000-8000-000000000301',
  '75000000-0000-4000-8000-000000000001',
  '75000000-0000-4000-8000-000000000201',
  'NEX-49 Driver A','12345678901','driver-a@nexora.test','11999990001','98765432109','E','2025-01-01',
  'blocked','blocked','Qualification blocked for NEX-49 fixture',
  '75000000-0000-4000-8000-000000000101','75000000-0000-4000-8000-000000000101'
);

INSERT INTO document_types (
  id,tenant_id,code,name,subject_scope,has_expiry,requires_validation
) VALUES (
  '75000000-0000-4000-8000-000000000411',
  '75000000-0000-4000-8000-000000000001',
  'NEX49-RISK','NEX-49 Risk Document','party',false,true
);

INSERT INTO documents (
  id,tenant_id,document_type_id,title,status,created_by_user_id,updated_by_user_id
) VALUES (
  '75000000-0000-4000-8000-000000000401',
  '75000000-0000-4000-8000-000000000001',
  '75000000-0000-4000-8000-000000000411',
  'NEX-49 rejected evidence','rejected',
  '75000000-0000-4000-8000-000000000101','75000000-0000-4000-8000-000000000101'
);

INSERT INTO document_validations (
  tenant_id,document_id,validation_type,result,notes,validated_by_user_id
) VALUES (
  '75000000-0000-4000-8000-000000000001',
  '75000000-0000-4000-8000-000000000401',
  'system','invalid','NEX-49 invalid validation fixture','75000000-0000-4000-8000-000000000101'
);
