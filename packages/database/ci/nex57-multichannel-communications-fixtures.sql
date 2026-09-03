INSERT INTO business_parties (
  id,tenant_id,tax_id,legal_name,email,phone,status,homologation_status
) VALUES
  (
    '77000000-0000-4000-8000-000000000801',
    '77000000-0000-4000-8000-000000000001',
    '57000000000101','NEX-57 Customer A','customer-a@nexora.test','1130001000','active','approved'
  ),
  (
    '77000000-0000-4000-8000-000000000802',
    '77000000-0000-4000-8000-000000000002',
    '57000000000102','NEX-57 Customer B','customer-b@nexora.test','1130002000','active','approved'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO business_party_contacts (
  id,tenant_id,party_id,type,name,email,phone,whatsapp,is_active
) VALUES
  (
    '77000000-0000-4000-8000-000000000811',
    '77000000-0000-4000-8000-000000000001',
    '77000000-0000-4000-8000-000000000801',
    'operational','NEX-57 Contact A','contact-a@nexora.test','551130001001','551199991001',true
  ),
  (
    '77000000-0000-4000-8000-000000000812',
    '77000000-0000-4000-8000-000000000002',
    '77000000-0000-4000-8000-000000000802',
    'operational','NEX-57 Contact B','contact-b@nexora.test','551130002001','551199992001',true
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO drivers (
  id,tenant_id,carrier_party_id,full_name,tax_id,email,phone,whatsapp,cnh_number,cnh_category,cnh_expires_on,
  registration_status,operational_status,created_by_user_id,updated_by_user_id
) VALUES (
  '77000000-0000-4000-8000-000000000821',
  '77000000-0000-4000-8000-000000000001',
  NULL,
  'NEX-57 Driver A','57000000001','driver-a@nexora.test','551130001002','551199991002',
  '57000000011','E','2028-12-31','qualified','active',
  '77000000-0000-4000-8000-000000000101','77000000-0000-4000-8000-000000000101'
)
ON CONFLICT (id) DO NOTHING;
