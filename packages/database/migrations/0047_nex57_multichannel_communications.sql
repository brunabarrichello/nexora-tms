INSERT INTO permissions (key, description)
VALUES
  ('notifications.read', 'Read tenant notification and outbound communication configuration/history'),
  ('notifications.write', 'Manage outbound communication templates/preferences and queue messages')
ON CONFLICT (key) DO NOTHING;--> statement-breakpoint

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
  FROM roles r
  JOIN permissions p ON p.key = 'notifications.read'
 WHERE r.code IN ('tenant_admin','operations_manager','dispatcher','finance_manager','auditor','viewer')
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
  FROM roles r
  JOIN permissions p ON p.key = 'notifications.write'
 WHERE r.code IN ('tenant_admin','operations_manager','dispatcher')
ON CONFLICT DO NOTHING;--> statement-breakpoint

CREATE TABLE "communication_provider_routes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "channel" varchar(20) NOT NULL,
  "provider_code" varchar(80) NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "updated_by_user_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "communication_provider_routes_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "communication_provider_routes_tenant_channel_unique" UNIQUE("tenant_id","channel"),
  CONSTRAINT "communication_provider_routes_channel_check" CHECK ("channel" IN ('email','whatsapp','sms')),
  CONSTRAINT "communication_provider_routes_provider_check" CHECK ("provider_code" ~ '^[a-z][a-z0-9._-]{1,79}$'),
  CONSTRAINT "communication_provider_routes_status_check" CHECK ("status" IN ('active','disabled'))
);--> statement-breakpoint

CREATE TABLE "communication_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "template_key" varchar(120) NOT NULL,
  "channel" varchar(20) NOT NULL,
  "locale" varchar(16) DEFAULT 'pt-BR' NOT NULL,
  "version" integer NOT NULL,
  "subject_template" varchar(500),
  "body_template" text NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "communication_templates_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "communication_templates_version_unique" UNIQUE("tenant_id","template_key","channel","locale","version"),
  CONSTRAINT "communication_templates_key_check" CHECK ("template_key" ~ '^[a-z][a-z0-9._-]{2,119}$'),
  CONSTRAINT "communication_templates_channel_check" CHECK ("channel" IN ('email','whatsapp','sms')),
  CONSTRAINT "communication_templates_locale_check" CHECK (length(trim("locale")) BETWEEN 2 AND 16),
  CONSTRAINT "communication_templates_version_check" CHECK ("version" > 0),
  CONSTRAINT "communication_templates_body_check" CHECK (length(trim("body_template")) BETWEEN 1 AND 10000),
  CONSTRAINT "communication_templates_email_subject_check" CHECK ("channel" <> 'email' OR ("subject_template" IS NOT NULL AND length(trim("subject_template")) > 0)),
  CONSTRAINT "communication_templates_status_check" CHECK ("status" IN ('draft','active','retired'))
);--> statement-breakpoint

CREATE TABLE "communication_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "recipient_type" varchar(30) NOT NULL,
  "recipient_id" uuid NOT NULL,
  "channel" varchar(20) NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "consent_status" varchar(20) DEFAULT 'unknown' NOT NULL,
  "consent_source" varchar(160),
  "consented_at" timestamptz,
  "policy_version" varchar(80) NOT NULL,
  "updated_by_user_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "communication_preferences_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "communication_preferences_recipient_channel_unique" UNIQUE("tenant_id","recipient_type","recipient_id","channel"),
  CONSTRAINT "communication_preferences_recipient_type_check" CHECK ("recipient_type" IN ('driver','party_contact')),
  CONSTRAINT "communication_preferences_channel_check" CHECK ("channel" IN ('email','whatsapp','sms')),
  CONSTRAINT "communication_preferences_consent_check" CHECK ("consent_status" IN ('granted','denied','unknown')),
  CONSTRAINT "communication_preferences_granted_metadata_check" CHECK ("consent_status" <> 'granted' OR ("consented_at" IS NOT NULL AND "consent_source" IS NOT NULL AND length(trim("consent_source")) >= 2)),
  CONSTRAINT "communication_preferences_policy_check" CHECK (length(trim("policy_version")) BETWEEN 1 AND 80)
);--> statement-breakpoint

CREATE TABLE "outbound_communications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "template_id" uuid NOT NULL,
  "template_key" varchar(120) NOT NULL,
  "template_version" integer NOT NULL,
  "channel" varchar(20) NOT NULL,
  "recipient_type" varchar(30) NOT NULL,
  "recipient_id" uuid NOT NULL,
  "destination" varchar(320),
  "provider_code" varchar(80),
  "variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "rendered_subject" varchar(500),
  "rendered_body" text NOT NULL,
  "status" varchar(24) DEFAULT 'queued' NOT NULL,
  "blocked_reason" varchar(500),
  "last_error" varchar(2000),
  "outbox_event_id" uuid,
  "durable_job_id" uuid,
  "idempotency_key" varchar(180) NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "sent_at" timestamptz,
  CONSTRAINT "outbound_communications_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "outbound_communications_tenant_idempotency_unique" UNIQUE("tenant_id","idempotency_key"),
  CONSTRAINT "outbound_communications_channel_check" CHECK ("channel" IN ('email','whatsapp','sms')),
  CONSTRAINT "outbound_communications_recipient_type_check" CHECK ("recipient_type" IN ('driver','party_contact')),
  CONSTRAINT "outbound_communications_status_check" CHECK ("status" IN ('queued','retry_wait','sent','failed','blocked','cancelled')),
  CONSTRAINT "outbound_communications_delivery_metadata_check" CHECK ("status" = 'blocked' OR ("destination" IS NOT NULL AND "provider_code" IS NOT NULL)),
  CONSTRAINT "outbound_communications_blocked_reason_check" CHECK ("status" <> 'blocked' OR "blocked_reason" IS NOT NULL),
  CONSTRAINT "outbound_communications_sent_at_check" CHECK ("status" <> 'sent' OR "sent_at" IS NOT NULL),
  CONSTRAINT "outbound_communications_body_check" CHECK (length(trim("rendered_body")) BETWEEN 1 AND 10000),
  CONSTRAINT "outbound_communications_idempotency_check" CHECK (length(trim("idempotency_key")) BETWEEN 3 AND 180)
);--> statement-breakpoint

CREATE TABLE "outbound_communication_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "communication_id" uuid NOT NULL,
  "attempt_no" integer NOT NULL,
  "job_attempt" integer NOT NULL,
  "provider_code" varchar(80) NOT NULL,
  "outcome" varchar(20) NOT NULL,
  "provider_message_id" varchar(240),
  "status_code" integer,
  "duration_ms" integer NOT NULL,
  "error_message" varchar(2000),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "outbound_communication_attempts_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "outbound_communication_attempts_number_unique" UNIQUE("tenant_id","communication_id","attempt_no"),
  CONSTRAINT "outbound_communication_attempts_attempt_check" CHECK ("attempt_no" > 0 AND "job_attempt" > 0),
  CONSTRAINT "outbound_communication_attempts_outcome_check" CHECK ("outcome" IN ('success','failure','cancelled')),
  CONSTRAINT "outbound_communication_attempts_status_code_check" CHECK ("status_code" IS NULL OR "status_code" BETWEEN 100 AND 599),
  CONSTRAINT "outbound_communication_attempts_duration_check" CHECK ("duration_ms" >= 0)
);--> statement-breakpoint

ALTER TABLE "communication_provider_routes" ADD CONSTRAINT "communication_provider_routes_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_provider_routes" ADD CONSTRAINT "communication_provider_routes_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_provider_routes" ADD CONSTRAINT "communication_provider_routes_updated_by_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_preferences" ADD CONSTRAINT "communication_preferences_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_preferences" ADD CONSTRAINT "communication_preferences_updated_by_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_communications" ADD CONSTRAINT "outbound_communications_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_communications" ADD CONSTRAINT "outbound_communications_template_fk" FOREIGN KEY ("tenant_id","template_id") REFERENCES "public"."communication_templates"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_communications" ADD CONSTRAINT "outbound_communications_outbox_fk" FOREIGN KEY ("tenant_id","outbox_event_id") REFERENCES "public"."outbox_events"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_communications" ADD CONSTRAINT "outbound_communications_job_fk" FOREIGN KEY ("tenant_id","durable_job_id") REFERENCES "public"."durable_jobs"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_communications" ADD CONSTRAINT "outbound_communications_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_communication_attempts" ADD CONSTRAINT "outbound_communication_attempts_communication_fk" FOREIGN KEY ("tenant_id","communication_id") REFERENCES "public"."outbound_communications"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "communication_templates_tenant_key_idx" ON "communication_templates" ("tenant_id","template_key","channel","locale","version" DESC);--> statement-breakpoint
CREATE INDEX "communication_preferences_tenant_recipient_idx" ON "communication_preferences" ("tenant_id","recipient_type","recipient_id");--> statement-breakpoint
CREATE INDEX "outbound_communications_tenant_status_idx" ON "outbound_communications" ("tenant_id","status","created_at" DESC);--> statement-breakpoint
CREATE INDEX "outbound_communications_tenant_recipient_idx" ON "outbound_communications" ("tenant_id","recipient_type","recipient_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "outbound_communication_attempts_delivery_idx" ON "outbound_communication_attempts" ("tenant_id","communication_id","attempt_no");--> statement-breakpoint

ALTER TABLE "communication_provider_routes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "communication_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "communication_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "outbound_communications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "outbound_communication_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "communication_provider_routes_tenant_select" ON "communication_provider_routes" FOR SELECT TO nexora_app USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "communication_templates_tenant_select" ON "communication_templates" FOR SELECT TO nexora_app USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "communication_preferences_tenant_select" ON "communication_preferences" FOR SELECT TO nexora_app USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "outbound_communications_tenant_select" ON "outbound_communications" FOR SELECT TO nexora_app USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "outbound_communication_attempts_tenant_select" ON "outbound_communication_attempts" FOR SELECT TO nexora_app USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

CREATE FUNCTION "nexora_guard_communication_template_update"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.template_key IS DISTINCT FROM OLD.template_key OR NEW.channel IS DISTINCT FROM OLD.channel
     OR NEW.locale IS DISTINCT FROM OLD.locale OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.subject_template IS DISTINCT FROM OLD.subject_template OR NEW.body_template IS DISTINCT FROM OLD.body_template
     OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'communication template versions are immutable' USING ERRCODE='P0001';
  END IF;
  IF OLD.status = 'retired' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'retired communication template cannot be reactivated' USING ERRCODE='P0001';
  END IF;
  IF OLD.status = 'active' AND NEW.status = 'draft' THEN
    RAISE EXCEPTION 'active communication template cannot return to draft' USING ERRCODE='P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_prevent_communication_delete"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'communication records cannot be deleted; use lifecycle state' USING ERRCODE='P0001';
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_guard_outbound_communication_update"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.template_id IS DISTINCT FROM OLD.template_id OR NEW.template_key IS DISTINCT FROM OLD.template_key
     OR NEW.template_version IS DISTINCT FROM OLD.template_version OR NEW.channel IS DISTINCT FROM OLD.channel
     OR NEW.recipient_type IS DISTINCT FROM OLD.recipient_type OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
     OR NEW.destination IS DISTINCT FROM OLD.destination OR NEW.provider_code IS DISTINCT FROM OLD.provider_code
     OR NEW.variables IS DISTINCT FROM OLD.variables OR NEW.rendered_subject IS DISTINCT FROM OLD.rendered_subject
     OR NEW.rendered_body IS DISTINCT FROM OLD.rendered_body OR NEW.outbox_event_id IS DISTINCT FROM OLD.outbox_event_id
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'outbound communication identity and rendered payload are immutable' USING ERRCODE='P0001';
  END IF;
  IF OLD.status IN ('sent','blocked','cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'terminal outbound communication cannot change status' USING ERRCODE='P0001';
  END IF;
  IF OLD.status = 'failed' AND NEW.status NOT IN ('failed','retry_wait') THEN
    RAISE EXCEPTION 'failed outbound communication may only be administratively requeued' USING ERRCODE='P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "communication_templates_guard_update" BEFORE UPDATE ON "communication_templates" FOR EACH ROW EXECUTE FUNCTION "nexora_guard_communication_template_update"();--> statement-breakpoint
CREATE TRIGGER "communication_templates_prevent_delete" BEFORE DELETE ON "communication_templates" FOR EACH ROW EXECUTE FUNCTION "nexora_prevent_communication_delete"();--> statement-breakpoint
CREATE TRIGGER "communication_provider_routes_prevent_delete" BEFORE DELETE ON "communication_provider_routes" FOR EACH ROW EXECUTE FUNCTION "nexora_prevent_communication_delete"();--> statement-breakpoint
CREATE TRIGGER "communication_preferences_prevent_delete" BEFORE DELETE ON "communication_preferences" FOR EACH ROW EXECUTE FUNCTION "nexora_prevent_communication_delete"();--> statement-breakpoint
CREATE TRIGGER "outbound_communications_guard_update" BEFORE UPDATE ON "outbound_communications" FOR EACH ROW EXECUTE FUNCTION "nexora_guard_outbound_communication_update"();--> statement-breakpoint
CREATE TRIGGER "outbound_communications_prevent_delete" BEFORE DELETE ON "outbound_communications" FOR EACH ROW EXECUTE FUNCTION "nexora_prevent_communication_delete"();--> statement-breakpoint
CREATE TRIGGER "outbound_communication_attempts_prevent_mutation" BEFORE UPDATE OR DELETE ON "outbound_communication_attempts" FOR EACH ROW EXECUTE FUNCTION "nexora_prevent_communication_delete"();--> statement-breakpoint

CREATE FUNCTION "nexora_resolve_communication_destination"(p_recipient_type text, p_recipient_id uuid, p_channel text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_destination text;
BEGIN
  v_tenant_id := nullif(current_setting('app.tenant_id', true), '')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant context is required for communication destination resolution' USING ERRCODE='42501';
  END IF;
  IF p_recipient_type NOT IN ('driver','party_contact') OR p_channel NOT IN ('email','whatsapp','sms') THEN
    RAISE EXCEPTION 'unsupported recipient type or communication channel' USING ERRCODE='22023';
  END IF;

  IF p_recipient_type = 'driver' THEN
    SELECT CASE p_channel WHEN 'email' THEN d.email WHEN 'whatsapp' THEN d.whatsapp WHEN 'sms' THEN d.phone END
      INTO v_destination
      FROM drivers d
     WHERE d.tenant_id = v_tenant_id AND d.id = p_recipient_id AND d.registration_status <> 'inactive';
  ELSE
    SELECT CASE p_channel WHEN 'email' THEN c.email WHEN 'whatsapp' THEN c.whatsapp WHEN 'sms' THEN c.phone END
      INTO v_destination
      FROM business_party_contacts c
     WHERE c.tenant_id = v_tenant_id AND c.id = p_recipient_id AND c.is_active = true;
  END IF;

  IF v_destination IS NULL OR length(trim(v_destination)) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN trim(v_destination);
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_upsert_communication_provider_route"(p_channel text, p_provider_code text, p_status text DEFAULT 'active')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_id uuid;
BEGIN
  v_tenant_id := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_user_id := nullif(current_setting('app.user_id', true), '')::uuid;
  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN RAISE EXCEPTION 'tenant and user context are required' USING ERRCODE='42501'; END IF;
  IF p_channel NOT IN ('email','whatsapp','sms') OR p_provider_code !~ '^[a-z][a-z0-9._-]{1,79}$' OR p_status NOT IN ('active','disabled') THEN
    RAISE EXCEPTION 'invalid communication provider route' USING ERRCODE='22023';
  END IF;

  INSERT INTO communication_provider_routes (tenant_id,channel,provider_code,status,created_by_user_id,updated_by_user_id)
  VALUES (v_tenant_id,p_channel,p_provider_code,p_status,v_user_id,v_user_id)
  ON CONFLICT (tenant_id,channel) DO UPDATE SET provider_code=excluded.provider_code,status=excluded.status,updated_by_user_id=v_user_id,updated_at=now()
  RETURNING id INTO v_id;

  INSERT INTO audit_events (tenant_id,action,outcome,source,entity_type,entity_id,actor_type,actor_user_id,metadata)
  VALUES (v_tenant_id,'notification.provider_route.configured','success','api','communication_provider_route',v_id::text,'user',v_user_id,jsonb_build_object('channel',p_channel,'providerCode',p_provider_code,'status',p_status));
  RETURN v_id;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_create_communication_template"(
  p_template_key text, p_channel text, p_locale text, p_version integer,
  p_subject_template text, p_body_template text, p_status text DEFAULT 'draft'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_id uuid;
BEGIN
  v_tenant_id := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_user_id := nullif(current_setting('app.user_id', true), '')::uuid;
  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN RAISE EXCEPTION 'tenant and user context are required' USING ERRCODE='42501'; END IF;
  IF p_template_key !~ '^[a-z][a-z0-9._-]{2,119}$' OR p_channel NOT IN ('email','whatsapp','sms') OR p_version IS NULL OR p_version <= 0 OR p_status NOT IN ('draft','active') THEN
    RAISE EXCEPTION 'invalid communication template metadata' USING ERRCODE='22023';
  END IF;
  IF p_locale IS NULL OR length(trim(p_locale)) NOT BETWEEN 2 AND 16 OR p_body_template IS NULL OR length(trim(p_body_template)) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'invalid communication template content' USING ERRCODE='22023';
  END IF;
  IF p_channel = 'email' AND (p_subject_template IS NULL OR length(trim(p_subject_template)) = 0) THEN
    RAISE EXCEPTION 'email templates require a subject' USING ERRCODE='22023';
  END IF;

  INSERT INTO communication_templates (tenant_id,template_key,channel,locale,version,subject_template,body_template,status,created_by_user_id)
  VALUES (v_tenant_id,p_template_key,p_channel,trim(p_locale),p_version,p_subject_template,p_body_template,p_status,v_user_id)
  RETURNING id INTO v_id;

  INSERT INTO audit_events (tenant_id,action,outcome,source,entity_type,entity_id,actor_type,actor_user_id,metadata)
  VALUES (v_tenant_id,'notification.template.created','success','api','communication_template',v_id::text,'user',v_user_id,jsonb_build_object('templateKey',p_template_key,'channel',p_channel,'locale',p_locale,'version',p_version,'status',p_status));
  RETURN v_id;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_set_communication_template_status"(p_template_id uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
BEGIN
  v_tenant_id := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_user_id := nullif(current_setting('app.user_id', true), '')::uuid;
  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN RAISE EXCEPTION 'tenant and user context are required' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('active','retired') THEN RAISE EXCEPTION 'template status must be active or retired' USING ERRCODE='22023'; END IF;

  UPDATE communication_templates SET status=p_status,updated_at=now()
   WHERE tenant_id=v_tenant_id AND id=p_template_id AND status <> 'retired';
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO audit_events (tenant_id,action,outcome,source,entity_type,entity_id,actor_type,actor_user_id,metadata)
  VALUES (v_tenant_id,'notification.template.status_changed','success','api','communication_template',p_template_id::text,'user',v_user_id,jsonb_build_object('status',p_status));
  RETURN true;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_upsert_communication_preference"(
  p_recipient_type text, p_recipient_id uuid, p_channel text, p_enabled boolean,
  p_consent_status text, p_consent_source text, p_consented_at timestamptz, p_policy_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_destination text;
  v_id uuid;
BEGIN
  v_tenant_id := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_user_id := nullif(current_setting('app.user_id', true), '')::uuid;
  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN RAISE EXCEPTION 'tenant and user context are required' USING ERRCODE='42501'; END IF;
  IF p_recipient_type NOT IN ('driver','party_contact') OR p_channel NOT IN ('email','whatsapp','sms') OR p_consent_status NOT IN ('granted','denied','unknown') THEN
    RAISE EXCEPTION 'invalid communication preference' USING ERRCODE='22023';
  END IF;
  IF p_policy_version IS NULL OR length(trim(p_policy_version)) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'policy version is required' USING ERRCODE='22023'; END IF;
  IF p_consent_status = 'granted' AND (p_consented_at IS NULL OR p_consent_source IS NULL OR length(trim(p_consent_source)) < 2) THEN
    RAISE EXCEPTION 'granted consent requires source and timestamp' USING ERRCODE='22023';
  END IF;
  v_destination := nexora_resolve_communication_destination(p_recipient_type,p_recipient_id,p_channel);
  IF v_destination IS NULL THEN RAISE EXCEPTION 'recipient does not have an active destination for this channel' USING ERRCODE='22023'; END IF;

  INSERT INTO communication_preferences (tenant_id,recipient_type,recipient_id,channel,enabled,consent_status,consent_source,consented_at,policy_version,updated_by_user_id)
  VALUES (v_tenant_id,p_recipient_type,p_recipient_id,p_channel,p_enabled,p_consent_status,p_consent_source,p_consented_at,trim(p_policy_version),v_user_id)
  ON CONFLICT (tenant_id,recipient_type,recipient_id,channel) DO UPDATE SET
    enabled=excluded.enabled,consent_status=excluded.consent_status,consent_source=excluded.consent_source,
    consented_at=excluded.consented_at,policy_version=excluded.policy_version,updated_by_user_id=v_user_id,updated_at=now()
  RETURNING id INTO v_id;

  INSERT INTO audit_events (tenant_id,action,outcome,source,entity_type,entity_id,actor_type,actor_user_id,metadata)
  VALUES (v_tenant_id,'notification.preference.updated','success','api','communication_preference',v_id::text,'user',v_user_id,jsonb_build_object('recipientType',p_recipient_type,'recipientId',p_recipient_id,'channel',p_channel,'enabled',p_enabled,'consentStatus',p_consent_status,'policyVersion',p_policy_version));
  RETURN v_id;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_queue_communication"(
  p_template_id uuid, p_recipient_type text, p_recipient_id uuid,
  p_variables jsonb, p_idempotency_key text, p_max_attempts integer DEFAULT 5
)
RETURNS TABLE(communication_id uuid, durable_job_id uuid, communication_status text, blocked_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_template communication_templates%ROWTYPE;
  v_preference communication_preferences%ROWTYPE;
  v_provider communication_provider_routes%ROWTYPE;
  v_destination text;
  v_subject text;
  v_body text;
  v_key text;
  v_value text;
  v_communication_id uuid;
  v_outbox_id uuid;
  v_job_id uuid;
  v_blocked_reason text;
  v_existing outbound_communications%ROWTYPE;
BEGIN
  v_tenant_id := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_user_id := nullif(current_setting('app.user_id', true), '')::uuid;
  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN RAISE EXCEPTION 'tenant and user context are required' USING ERRCODE='42501'; END IF;
  IF p_recipient_type NOT IN ('driver','party_contact') OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) NOT BETWEEN 3 AND 180 OR p_max_attempts NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'invalid communication request metadata' USING ERRCODE='22023';
  END IF;
  IF p_variables IS NULL THEN p_variables := '{}'::jsonb; END IF;
  IF jsonb_typeof(p_variables) <> 'object' THEN RAISE EXCEPTION 'communication variables must be a JSON object' USING ERRCODE='22023'; END IF;

  SELECT c.* INTO v_existing FROM outbound_communications c WHERE c.tenant_id=v_tenant_id AND c.idempotency_key=trim(p_idempotency_key);
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id,v_existing.durable_job_id,v_existing.status::text,v_existing.blocked_reason::text;
    RETURN;
  END IF;

  SELECT t.* INTO v_template FROM communication_templates t WHERE t.tenant_id=v_tenant_id AND t.id=p_template_id AND t.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'active communication template not found' USING ERRCODE='P0002'; END IF;

  v_subject := v_template.subject_template;
  v_body := v_template.body_template;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each_text(p_variables) LOOP
    v_body := replace(v_body,'{{' || v_key || '}}',v_value);
    IF v_subject IS NOT NULL THEN v_subject := replace(v_subject,'{{' || v_key || '}}',v_value); END IF;
  END LOOP;
  IF v_body ~ '\{\{[A-Za-z0-9_.-]+\}\}' OR coalesce(v_subject,'') ~ '\{\{[A-Za-z0-9_.-]+\}\}' THEN
    RAISE EXCEPTION 'communication template contains unresolved variables' USING ERRCODE='22023';
  END IF;

  SELECT p.* INTO v_preference FROM communication_preferences p
   WHERE p.tenant_id=v_tenant_id AND p.recipient_type=p_recipient_type AND p.recipient_id=p_recipient_id AND p.channel=v_template.channel;
  IF NOT FOUND OR NOT v_preference.enabled OR v_preference.consent_status <> 'granted' THEN
    v_blocked_reason := 'channel_preference_not_granted';
  END IF;

  IF v_blocked_reason IS NULL THEN
    v_destination := nexora_resolve_communication_destination(p_recipient_type,p_recipient_id,v_template.channel);
    IF v_destination IS NULL THEN v_blocked_reason := 'destination_unavailable'; END IF;
  END IF;

  IF v_blocked_reason IS NULL THEN
    SELECT r.* INTO v_provider FROM communication_provider_routes r WHERE r.tenant_id=v_tenant_id AND r.channel=v_template.channel AND r.status='active';
    IF NOT FOUND THEN v_blocked_reason := 'provider_not_configured'; END IF;
  END IF;

  v_communication_id := gen_random_uuid();
  IF v_blocked_reason IS NOT NULL THEN
    INSERT INTO outbound_communications (
      id,tenant_id,template_id,template_key,template_version,channel,recipient_type,recipient_id,destination,provider_code,
      variables,rendered_subject,rendered_body,status,blocked_reason,idempotency_key,created_by_user_id
    ) VALUES (
      v_communication_id,v_tenant_id,v_template.id,v_template.template_key,v_template.version,v_template.channel,p_recipient_type,p_recipient_id,
      v_destination,CASE WHEN v_provider.id IS NULL THEN NULL ELSE v_provider.provider_code END,p_variables,v_subject,v_body,'blocked',v_blocked_reason,trim(p_idempotency_key),v_user_id
    );
    INSERT INTO audit_events (tenant_id,action,outcome,source,entity_type,entity_id,actor_type,actor_user_id,idempotency_key,reason,metadata)
    VALUES (v_tenant_id,'notification.communication.blocked','denied','api','outbound_communication',v_communication_id::text,'user',v_user_id,trim(p_idempotency_key),v_blocked_reason,jsonb_build_object('channel',v_template.channel,'recipientType',p_recipient_type,'recipientId',p_recipient_id,'templateKey',v_template.template_key,'templateVersion',v_template.version));
    RETURN QUERY SELECT v_communication_id,NULL::uuid,'blocked'::text,v_blocked_reason;
    RETURN;
  END IF;

  INSERT INTO outbox_events (tenant_id,aggregate_type,aggregate_id,event_type,event_version,payload,idempotency_key,available_at,max_attempts)
  VALUES (v_tenant_id,'outbound_communication',v_communication_id::text,'notifications.communication.queued',1,
    jsonb_build_object('communicationId',v_communication_id,'channel',v_template.channel,'recipientType',p_recipient_type,'recipientId',p_recipient_id,'templateKey',v_template.template_key,'templateVersion',v_template.version),
    'communication-outbox:' || v_communication_id::text,now(),10)
  RETURNING id INTO v_outbox_id;

  INSERT INTO outbound_communications (
    id,tenant_id,template_id,template_key,template_version,channel,recipient_type,recipient_id,destination,provider_code,
    variables,rendered_subject,rendered_body,status,outbox_event_id,idempotency_key,created_by_user_id
  ) VALUES (
    v_communication_id,v_tenant_id,v_template.id,v_template.template_key,v_template.version,v_template.channel,p_recipient_type,p_recipient_id,
    v_destination,v_provider.provider_code,p_variables,v_subject,v_body,'queued',v_outbox_id,trim(p_idempotency_key),v_user_id
  );

  INSERT INTO durable_jobs (tenant_id,source_outbox_event_id,job_type,payload,status,idempotency_key,run_at,max_attempts)
  VALUES (v_tenant_id,v_outbox_id,'notifications.communication.deliver',jsonb_build_object('communicationId',v_communication_id),'pending','communication:' || v_communication_id::text,now(),p_max_attempts)
  RETURNING id INTO v_job_id;

  UPDATE outbound_communications SET durable_job_id=v_job_id,updated_at=now() WHERE id=v_communication_id;

  INSERT INTO audit_events (tenant_id,action,outcome,source,entity_type,entity_id,actor_type,actor_user_id,idempotency_key,metadata)
  VALUES (v_tenant_id,'notification.communication.queued','success','api','outbound_communication',v_communication_id::text,'user',v_user_id,trim(p_idempotency_key),jsonb_build_object('channel',v_template.channel,'providerCode',v_provider.provider_code,'recipientType',p_recipient_type,'recipientId',p_recipient_id,'templateKey',v_template.template_key,'templateVersion',v_template.version,'durableJobId',v_job_id));

  RETURN QUERY SELECT v_communication_id,v_job_id,'queued'::text,NULL::text;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_worker_get_communication"(p_communication_id uuid)
RETURNS TABLE(
  communication_id uuid, tenant_id uuid, communication_status text, route_status text,
  provider_code text, channel text, destination text, rendered_subject text, rendered_body text, idempotency_key text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT c.id,c.tenant_id,c.status::text,coalesce(r.status,'disabled')::text,c.provider_code::text,c.channel::text,c.destination::text,c.rendered_subject::text,c.rendered_body,c.idempotency_key::text
    FROM outbound_communications c
    LEFT JOIN communication_provider_routes r ON r.tenant_id=c.tenant_id AND r.channel=c.channel AND r.provider_code=c.provider_code
   WHERE c.id=p_communication_id
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_worker_record_communication_attempt"(
  p_communication_id uuid, p_job_attempt integer, p_outcome text, p_provider_message_id text,
  p_status_code integer, p_duration_ms integer, p_error_message text, p_terminal boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_communication outbound_communications%ROWTYPE;
  v_attempt_no integer;
  v_action text;
BEGIN
  IF p_job_attempt < 1 OR p_outcome NOT IN ('success','failure','cancelled') OR p_duration_ms < 0 THEN RAISE EXCEPTION 'invalid communication attempt' USING ERRCODE='22023'; END IF;
  IF p_status_code IS NOT NULL AND (p_status_code < 100 OR p_status_code > 599) THEN RAISE EXCEPTION 'invalid communication provider status code' USING ERRCODE='22023'; END IF;

  SELECT c.* INTO v_communication FROM outbound_communications c WHERE c.id=p_communication_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_communication.status IN ('sent','blocked','cancelled') THEN RETURN false; END IF;

  SELECT coalesce(max(a.attempt_no),0)+1 INTO v_attempt_no FROM outbound_communication_attempts a WHERE a.tenant_id=v_communication.tenant_id AND a.communication_id=v_communication.id;
  INSERT INTO outbound_communication_attempts (tenant_id,communication_id,attempt_no,job_attempt,provider_code,outcome,provider_message_id,status_code,duration_ms,error_message)
  VALUES (v_communication.tenant_id,v_communication.id,v_attempt_no,p_job_attempt,v_communication.provider_code,p_outcome,left(p_provider_message_id,240),p_status_code,p_duration_ms,CASE WHEN p_error_message IS NULL THEN NULL ELSE left(p_error_message,2000) END);

  IF p_outcome='success' THEN
    UPDATE outbound_communications SET status='sent',sent_at=now(),last_error=NULL,updated_at=now() WHERE id=v_communication.id;
    v_action := 'notification.communication.sent';
  ELSIF p_outcome='cancelled' THEN
    UPDATE outbound_communications SET status='cancelled',last_error=left(coalesce(p_error_message,'provider route disabled'),2000),updated_at=now() WHERE id=v_communication.id;
    v_action := 'notification.communication.cancelled';
  ELSIF p_terminal THEN
    UPDATE outbound_communications SET status='failed',last_error=left(coalesce(p_error_message,'provider failure'),2000),updated_at=now() WHERE id=v_communication.id;
    v_action := 'notification.communication.failed';
  ELSE
    UPDATE outbound_communications SET status='retry_wait',last_error=left(coalesce(p_error_message,'provider failure'),2000),updated_at=now() WHERE id=v_communication.id;
    v_action := 'notification.communication.retry_scheduled';
  END IF;

  INSERT INTO audit_events (tenant_id,action,outcome,source,entity_type,entity_id,actor_type,idempotency_key,reason,metadata)
  VALUES (v_communication.tenant_id,v_action,CASE WHEN p_outcome='success' THEN 'success' WHEN p_outcome='cancelled' THEN 'denied' ELSE 'failure' END,'worker','outbound_communication',v_communication.id::text,'system',v_communication.idempotency_key,CASE WHEN p_error_message IS NULL THEN NULL ELSE left(p_error_message,500) END,jsonb_build_object('channel',v_communication.channel,'providerCode',v_communication.provider_code,'attemptNo',v_attempt_no,'jobAttempt',p_job_attempt,'terminal',p_terminal,'providerMessageId',p_provider_message_id,'statusCode',p_status_code));
  RETURN true;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_sync_communication_reprocess"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.job_type='notifications.communication.deliver' AND OLD.status='dead_lettered' AND NEW.status='pending' THEN
    UPDATE outbound_communications SET status='retry_wait',last_error=NULL,updated_at=now()
     WHERE tenant_id=NEW.tenant_id AND durable_job_id=NEW.id AND status='failed';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "durable_jobs_sync_communication_reprocess" AFTER UPDATE ON "durable_jobs" FOR EACH ROW EXECUTE FUNCTION "nexora_sync_communication_reprocess"();--> statement-breakpoint

REVOKE ALL ON TABLE "communication_provider_routes" FROM nexora_app;--> statement-breakpoint
REVOKE ALL ON TABLE "communication_templates" FROM nexora_app;--> statement-breakpoint
REVOKE ALL ON TABLE "communication_preferences" FROM nexora_app;--> statement-breakpoint
REVOKE ALL ON TABLE "outbound_communications" FROM nexora_app;--> statement-breakpoint
REVOKE ALL ON TABLE "outbound_communication_attempts" FROM nexora_app;--> statement-breakpoint
GRANT SELECT ON TABLE "communication_provider_routes" TO nexora_app;--> statement-breakpoint
GRANT SELECT ON TABLE "communication_templates" TO nexora_app;--> statement-breakpoint
GRANT SELECT ON TABLE "communication_preferences" TO nexora_app;--> statement-breakpoint
GRANT SELECT ON TABLE "outbound_communications" TO nexora_app;--> statement-breakpoint
GRANT SELECT ON TABLE "outbound_communication_attempts" TO nexora_app;--> statement-breakpoint

REVOKE ALL ON FUNCTION "nexora_guard_communication_template_update"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_prevent_communication_delete"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_guard_outbound_communication_update"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_resolve_communication_destination"(text,uuid,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_upsert_communication_provider_route"(text,text,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_create_communication_template"(text,text,text,integer,text,text,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_set_communication_template_status"(uuid,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_upsert_communication_preference"(text,uuid,text,boolean,text,text,timestamptz,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_queue_communication"(uuid,text,uuid,jsonb,text,integer) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_worker_get_communication"(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_worker_record_communication_attempt"(uuid,integer,text,text,integer,integer,text,boolean) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_sync_communication_reprocess"() FROM PUBLIC;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION "nexora_resolve_communication_destination"(text,uuid,text) TO nexora_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_upsert_communication_provider_route"(text,text,text) TO nexora_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_create_communication_template"(text,text,text,integer,text,text,text) TO nexora_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_set_communication_template_status"(uuid,text) TO nexora_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_upsert_communication_preference"(text,uuid,text,boolean,text,text,timestamptz,text) TO nexora_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_queue_communication"(uuid,text,uuid,jsonb,text,integer) TO nexora_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_worker_get_communication"(uuid) TO nexora_worker;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_worker_record_communication_attempt"(uuid,integer,text,text,integer,integer,text,boolean) TO nexora_worker;