INSERT INTO tenants (id,slug,name,status)
VALUES
  ('78200000-0000-4000-8000-000000000001','nex56-tenant-a','NEX-56 Tenant A','active'),
  ('78200000-0000-4000-8000-000000000002','nex56-tenant-b','NEX-56 Tenant B','active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id,display_name,status)
VALUES
  ('78200000-0000-4000-8000-000000000101','NEX-56 Tenant Admin A','active'),
  ('78200000-0000-4000-8000-000000000201','NEX-56 Tenant Admin B','active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (id,tenant_id,user_id,status,joined_at)
VALUES
  ('78200000-0000-4000-8000-000000000301','78200000-0000-4000-8000-000000000001','78200000-0000-4000-8000-000000000101','active',now()),
  ('78200000-0000-4000-8000-000000000302','78200000-0000-4000-8000-000000000002','78200000-0000-4000-8000-000000000201','active',now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id,tenant_id,code,name)
VALUES
  ('78200000-0000-4000-8000-000000000401','78200000-0000-4000-8000-000000000001','tenant_admin','Tenant Admin'),
  ('78200000-0000-4000-8000-000000000402','78200000-0000-4000-8000-000000000002','tenant_admin','Tenant Admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO membership_roles (tenant_id,membership_id,role_id)
VALUES
  ('78200000-0000-4000-8000-000000000001','78200000-0000-4000-8000-000000000301','78200000-0000-4000-8000-000000000401'),
  ('78200000-0000-4000-8000-000000000002','78200000-0000-4000-8000-000000000302','78200000-0000-4000-8000-000000000402')
ON CONFLICT DO NOTHING;

INSERT INTO integration_clients (
  id,tenant_id,name,status,secret_hash,scopes,expires_at,created_by_user_id
) VALUES (
  '78200000-0000-4000-8000-000000000501',
  '78200000-0000-4000-8000-000000000001',
  'NEX-56 ERP A',
  'active',
  decode(repeat('11',32),'hex'),
  ARRAY['freight.read','trips.read']::text[],
  now() + interval '30 days',
  '78200000-0000-4000-8000-000000000101'
),(
  '78200000-0000-4000-8000-000000000502',
  '78200000-0000-4000-8000-000000000002',
  'NEX-56 ERP B',
  'active',
  decode(repeat('22',32),'hex'),
  ARRAY['documents.read']::text[],
  now() + interval '30 days',
  '78200000-0000-4000-8000-000000000201'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO webhook_subscriptions (
  id,tenant_id,integration_client_id,name,endpoint_url,event_types,api_version,status,
  signing_secret_ciphertext,signing_secret_iv,signing_secret_tag,max_attempts,timeout_ms,
  created_by_user_id,updated_by_user_id
) VALUES (
  '78200000-0000-4000-8000-000000000601',
  '78200000-0000-4000-8000-000000000001',
  '78200000-0000-4000-8000-000000000501',
  'NEX-56 ERP A webhook',
  'https://example.com/nexora-webhook',
  ARRAY['nex56.integration.test']::text[],
  1,
  'active',
  'ZmFrZS1jaXBoZXJ0ZXh0',
  'ZmFrZS1pdi0xMjM0NTY=',
  'ZmFrZS10YWctMTIzNDU2',
  2,
  5000,
  '78200000-0000-4000-8000-000000000101',
  '78200000-0000-4000-8000-000000000101'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO outbox_events (
  id,tenant_id,aggregate_type,aggregate_id,event_type,event_version,payload,
  idempotency_key,correlation_id,request_id,available_at,max_attempts
) VALUES (
  '78200000-0000-4000-8000-000000000701',
  '78200000-0000-4000-8000-000000000001',
  'integration_fixture',
  'nex56-entity-001',
  'nex56.integration.test',
  1,
  jsonb_build_object('fixture','nex56','entityId','nex56-entity-001'),
  'nex56:source:event-001',
  'nex56-correlation-001',
  'nex56-request-001',
  now(),
  3
)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_delivery_count integer;
  v_job_count integer;
BEGIN
  SELECT count(*) INTO v_delivery_count
    FROM webhook_deliveries
   WHERE tenant_id='78200000-0000-4000-8000-000000000001'
     AND subscription_id='78200000-0000-4000-8000-000000000601'
     AND outbox_event_id='78200000-0000-4000-8000-000000000701';
  IF v_delivery_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one NEX-56 webhook delivery, got %', v_delivery_count;
  END IF;

  SELECT count(*) INTO v_job_count
    FROM durable_jobs
   WHERE tenant_id='78200000-0000-4000-8000-000000000001'
     AND source_outbox_event_id='78200000-0000-4000-8000-000000000701'
     AND job_type='integrations.webhook.deliver';
  IF v_job_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one NEX-56 durable webhook job, got %', v_job_count;
  END IF;
END $$;