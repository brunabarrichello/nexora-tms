INSERT INTO document_types (
  id,tenant_id,code,name,subject_scope,has_expiry,requires_validation
) VALUES (
  '76000000-0000-4000-8000-000000000911',
  '76000000-0000-4000-8000-000000000001',
  'NEX51-PAYMENT-PROOF','Comprovante financeiro NEX-51','financial',false,false
);

INSERT INTO documents (
  id,tenant_id,document_type_id,title,status,external_reference,created_by_user_id,updated_by_user_id
) VALUES (
  '76000000-0000-4000-8000-000000000921',
  '76000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000911',
  'Comprovante de adiantamento NEX-51','valid','BANK-NEX51-001',
  '76000000-0000-4000-8000-000000000101','76000000-0000-4000-8000-000000000101'
);
