INSERT INTO tenants (id,slug,name,status)
VALUES
  ('78000000-0000-4000-8000-000000000001','nex55-tenant-a','NEX-55 Tenant A','active'),
  ('78000000-0000-4000-8000-000000000002','nex55-tenant-b','NEX-55 Tenant B','active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id,display_name,status)
VALUES
  ('78000000-0000-4000-8000-000000000101','NEX-55 Tenant Admin A','active'),
  ('78000000-0000-4000-8000-000000000102','NEX-55 Operations A','active'),
  ('78000000-0000-4000-8000-000000000201','NEX-55 Tenant Admin B','active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (id,tenant_id,user_id,status,joined_at)
VALUES
  ('78000000-0000-4000-8000-000000000301','78000000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000101','active',now()),
  ('78000000-0000-4000-8000-000000000302','78000000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000102','active',now()),
  ('78000000-0000-4000-8000-000000000303','78000000-0000-4000-8000-000000000002','78000000-0000-4000-8000-000000000201','active',now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id,tenant_id,code,name)
VALUES
  ('78000000-0000-4000-8000-000000000401','78000000-0000-4000-8000-000000000001','tenant_admin','Tenant Admin'),
  ('78000000-0000-4000-8000-000000000402','78000000-0000-4000-8000-000000000001','operations_manager','Operations Manager'),
  ('78000000-0000-4000-8000-000000000403','78000000-0000-4000-8000-000000000002','tenant_admin','Tenant Admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO membership_roles (tenant_id,membership_id,role_id)
VALUES
  ('78000000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000301','78000000-0000-4000-8000-000000000401'),
  ('78000000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000302','78000000-0000-4000-8000-000000000402'),
  ('78000000-0000-4000-8000-000000000002','78000000-0000-4000-8000-000000000303','78000000-0000-4000-8000-000000000403')
ON CONFLICT DO NOTHING;

INSERT INTO outbox_events (
  id,tenant_id,aggregate_type,aggregate_id,event_type,event_version,payload,
  idempotency_key,correlation_id,request_id,available_at,max_attempts
) VALUES (
  '78000000-0000-4000-8000-000000000501',
  '78000000-0000-4000-8000-000000000001',
  'transport_request',
  'nex55-request-001',
  'freight.transport_request.created',
  1,
  jsonb_build_object(
    'channel','in_app',
    'module','freight',
    'contextUrl','/cargas',
    'title','NEX-55 retry fixture'
  ),
  'nex55:outbox:notification-001',
  'nex55-correlation-001',
  'nex55-request-trace-001',
  now() - interval '1 minute',
  2
)
ON CONFLICT (id) DO UPDATE SET
  processed_at=NULL,
  attempts=0,
  available_at=now() - interval '1 minute',
  lease_owner=NULL,
  lease_expires_at=NULL,
  last_error=NULL,
  dead_lettered_at=NULL,
  dead_letter_reason=NULL,
  max_attempts=2,
  updated_at=now();

INSERT INTO durable_jobs (
  id,tenant_id,job_type,payload,status,idempotency_key,correlation_id,request_id,
  run_at,attempt,max_attempts
) VALUES (
  '78000000-0000-4000-8000-000000000601',
  '78000000-0000-4000-8000-000000000001',
  'nexora.worker.smoke',
  jsonb_build_object('fixture','nex55'),
  'pending',
  'nex55:job:smoke-001',
  'nex55-correlation-002',
  'nex55-request-trace-002',
  now() - interval '1 minute',
  0,
  2
)
ON CONFLICT (id) DO UPDATE SET
  status='pending',
  run_at=now() - interval '1 minute',
  attempt=0,
  max_attempts=2,
  locked_at=NULL,
  locked_by=NULL,
  lease_expires_at=NULL,
  last_error=NULL,
  finished_at=NULL,
  updated_at=now();
