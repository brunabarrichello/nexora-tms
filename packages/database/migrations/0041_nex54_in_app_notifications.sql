CREATE TABLE "in_app_notification_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "outbox_event_id" uuid NOT NULL,
  "event_key" varchar(180) NOT NULL,
  "event_type" varchar(160) NOT NULL,
  "event_version" integer DEFAULT 1 NOT NULL,
  "module" varchar(40) NOT NULL,
  "aggregate_type" varchar(100) NOT NULL,
  "aggregate_id" varchar(160) NOT NULL,
  "title" varchar(240) NOT NULL,
  "body" varchar(2000) NOT NULL,
  "context_url" varchar(500) NOT NULL,
  "severity" varchar(20) DEFAULT 'info' NOT NULL,
  "target_role_codes" text[] NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "in_app_notification_events_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "in_app_notification_events_tenant_event_key_unique" UNIQUE("tenant_id","event_key"),
  CONSTRAINT "in_app_notification_events_event_key_check" CHECK (length(trim("event_key")) > 0),
  CONSTRAINT "in_app_notification_events_event_type_check" CHECK (length(trim("event_type")) > 0),
  CONSTRAINT "in_app_notification_events_event_version_check" CHECK ("event_version" > 0),
  CONSTRAINT "in_app_notification_events_module_check" CHECK ("module" IN ('freight','negotiation','trips','documents')),
  CONSTRAINT "in_app_notification_events_aggregate_type_check" CHECK (length(trim("aggregate_type")) > 0),
  CONSTRAINT "in_app_notification_events_aggregate_id_check" CHECK (length(trim("aggregate_id")) > 0),
  CONSTRAINT "in_app_notification_events_title_check" CHECK (length(trim("title")) > 0),
  CONSTRAINT "in_app_notification_events_body_check" CHECK (length(trim("body")) > 0),
  CONSTRAINT "in_app_notification_events_context_url_check" CHECK ("context_url" LIKE '/%'),
  CONSTRAINT "in_app_notification_events_severity_check" CHECK ("severity" IN ('info','warning','critical')),
  CONSTRAINT "in_app_notification_events_target_roles_check" CHECK (cardinality("target_role_codes") > 0)
);--> statement-breakpoint

ALTER TABLE "in_app_notification_events"
  ADD CONSTRAINT "in_app_notification_events_tenant_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notification_events"
  ADD CONSTRAINT "in_app_notification_events_outbox_fk"
  FOREIGN KEY ("tenant_id","outbox_event_id") REFERENCES "public"."outbox_events"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notification_events"
  ADD CONSTRAINT "in_app_notification_events_actor_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "in_app_notification_events_tenant_created_idx"
  ON "in_app_notification_events" ("tenant_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "in_app_notification_events_tenant_module_idx"
  ON "in_app_notification_events" ("tenant_id","module","created_at" DESC);--> statement-breakpoint
CREATE INDEX "in_app_notification_events_outbox_idx"
  ON "in_app_notification_events" ("tenant_id","outbox_event_id");--> statement-breakpoint

CREATE TABLE "in_app_notification_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "notification_event_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "delivered_at" timestamptz DEFAULT now() NOT NULL,
  "read_at" timestamptz,
  CONSTRAINT "in_app_notification_deliveries_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "in_app_notification_deliveries_event_user_unique" UNIQUE("tenant_id","notification_event_id","user_id")
);--> statement-breakpoint

ALTER TABLE "in_app_notification_deliveries"
  ADD CONSTRAINT "in_app_notification_deliveries_tenant_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notification_deliveries"
  ADD CONSTRAINT "in_app_notification_deliveries_event_fk"
  FOREIGN KEY ("tenant_id","notification_event_id") REFERENCES "public"."in_app_notification_events"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notification_deliveries"
  ADD CONSTRAINT "in_app_notification_deliveries_user_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "in_app_notification_deliveries_user_inbox_idx"
  ON "in_app_notification_deliveries" ("tenant_id","user_id","read_at","delivered_at" DESC);--> statement-breakpoint
CREATE INDEX "in_app_notification_deliveries_event_idx"
  ON "in_app_notification_deliveries" ("tenant_id","notification_event_id");--> statement-breakpoint

ALTER TABLE "in_app_notification_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "in_app_notification_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "in_app_notification_events_recipient_select"
  ON "in_app_notification_events"
  FOR SELECT TO nexora_app
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
        FROM in_app_notification_deliveries d
       WHERE d.tenant_id = in_app_notification_events.tenant_id
         AND d.notification_event_id = in_app_notification_events.id
         AND d.user_id = nullif(current_setting('app.user_id', true), '')::uuid
    )
  );--> statement-breakpoint

CREATE POLICY "in_app_notification_deliveries_recipient_select"
  ON "in_app_notification_deliveries"
  FOR SELECT TO nexora_app
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = nullif(current_setting('app.user_id', true), '')::uuid
  );--> statement-breakpoint

CREATE POLICY "in_app_notification_deliveries_recipient_update"
  ON "in_app_notification_deliveries"
  FOR UPDATE TO nexora_app
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = nullif(current_setting('app.user_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = nullif(current_setting('app.user_id', true), '')::uuid
  );--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_prevent_in_app_notification_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'in-app notification events are immutable' USING ERRCODE = 'P0001';
END;
$$;--> statement-breakpoint

CREATE TRIGGER "in_app_notification_events_immutable"
BEFORE UPDATE OR DELETE ON "in_app_notification_events"
FOR EACH ROW EXECUTE FUNCTION "nexora_prevent_in_app_notification_event_mutation"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_guard_in_app_notification_delivery_update"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.notification_event_id IS DISTINCT FROM OLD.notification_event_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at THEN
    RAISE EXCEPTION 'only read_at may change on an in-app notification delivery' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at THEN
    RAISE EXCEPTION 'an in-app notification cannot be marked unread after it is read' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.read_at IS NULL AND NEW.read_at IS NULL THEN
    RAISE EXCEPTION 'read_at must be set when updating an in-app notification delivery' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "in_app_notification_deliveries_guard_update"
BEFORE UPDATE ON "in_app_notification_deliveries"
FOR EACH ROW EXECUTE FUNCTION "nexora_guard_in_app_notification_delivery_update"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_emit_in_app_notification"(
  p_event_key text,
  p_event_type text,
  p_event_version integer,
  p_module text,
  p_aggregate_type text,
  p_aggregate_id text,
  p_title text,
  p_body text,
  p_context_url text,
  p_severity text,
  p_role_codes text[],
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(notification_event_id uuid, outbox_event_id uuid, delivery_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_outbox_event_id uuid;
  v_notification_event_id uuid;
  v_delivery_count integer := 0;
  v_created boolean := false;
BEGIN
  v_tenant_id := nullif(current_setting('app.tenant_id', true), '')::uuid;
  v_user_id := nullif(current_setting('app.user_id', true), '')::uuid;

  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'tenant and user context are required for in-app notifications' USING ERRCODE = '42501';
  END IF;
  IF p_event_key IS NULL OR length(trim(p_event_key)) = 0 OR length(p_event_key) > 170 THEN
    RAISE EXCEPTION 'event key must contain between 1 and 170 characters' USING ERRCODE = '22023';
  END IF;
  IF p_event_type IS NULL OR length(trim(p_event_type)) = 0 THEN
    RAISE EXCEPTION 'event type is required' USING ERRCODE = '22023';
  END IF;
  IF p_event_version IS NULL OR p_event_version <= 0 THEN
    RAISE EXCEPTION 'event version must be positive' USING ERRCODE = '22023';
  END IF;
  IF p_module NOT IN ('freight','negotiation','trips','documents') THEN
    RAISE EXCEPTION 'unsupported notification module' USING ERRCODE = '22023';
  END IF;
  IF p_severity NOT IN ('info','warning','critical') THEN
    RAISE EXCEPTION 'unsupported notification severity' USING ERRCODE = '22023';
  END IF;
  IF p_context_url IS NULL OR p_context_url !~ '^/' THEN
    RAISE EXCEPTION 'context URL must be an internal absolute path' USING ERRCODE = '22023';
  END IF;
  IF p_role_codes IS NULL OR cardinality(p_role_codes) = 0 THEN
    RAISE EXCEPTION 'at least one target role is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO outbox_events (
    tenant_id,aggregate_type,aggregate_id,event_type,event_version,payload,idempotency_key,
    correlation_id,request_id,available_at,max_attempts
  ) VALUES (
    v_tenant_id,
    p_aggregate_type,
    p_aggregate_id,
    p_event_type,
    p_event_version,
    jsonb_build_object(
      'channel','in_app',
      'module',p_module,
      'title',p_title,
      'body',p_body,
      'contextUrl',p_context_url,
      'severity',p_severity,
      'targetRoleCodes',to_jsonb(p_role_codes)
    ) || coalesce(p_payload,'{}'::jsonb),
    'in-app:' || p_event_key,
    null,
    null,
    now(),
    10
  )
  ON CONFLICT (tenant_id,idempotency_key) DO NOTHING
  RETURNING id INTO v_outbox_event_id;

  IF v_outbox_event_id IS NULL THEN
    SELECT id
      INTO v_outbox_event_id
      FROM outbox_events
     WHERE tenant_id = v_tenant_id
       AND idempotency_key = 'in-app:' || p_event_key;
  END IF;

  INSERT INTO in_app_notification_events (
    tenant_id,outbox_event_id,event_key,event_type,event_version,module,aggregate_type,aggregate_id,
    title,body,context_url,severity,target_role_codes,payload,actor_user_id
  ) VALUES (
    v_tenant_id,v_outbox_event_id,p_event_key,p_event_type,p_event_version,p_module,p_aggregate_type,
    p_aggregate_id,p_title,p_body,p_context_url,p_severity,p_role_codes,coalesce(p_payload,'{}'::jsonb),v_user_id
  )
  ON CONFLICT (tenant_id,event_key) DO NOTHING
  RETURNING id INTO v_notification_event_id;

  IF v_notification_event_id IS NOT NULL THEN
    v_created := true;
  ELSE
    SELECT id
      INTO v_notification_event_id
      FROM in_app_notification_events
     WHERE tenant_id = v_tenant_id
       AND event_key = p_event_key;
  END IF;

  IF v_created THEN
    INSERT INTO in_app_notification_deliveries (tenant_id,notification_event_id,user_id)
    SELECT v_tenant_id,v_notification_event_id,m.user_id
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      JOIN membership_roles mr
        ON mr.tenant_id = m.tenant_id
       AND mr.membership_id = m.id
      JOIN roles r
        ON r.tenant_id = mr.tenant_id
       AND r.id = mr.role_id
     WHERE m.tenant_id = v_tenant_id
       AND m.status = 'active'
       AND u.status = 'active'
       AND r.code = ANY(p_role_codes)
     GROUP BY m.user_id
    ON CONFLICT (tenant_id,notification_event_id,user_id) DO NOTHING;
  END IF;

  SELECT count(*)::integer
    INTO v_delivery_count
    FROM in_app_notification_deliveries
   WHERE tenant_id = v_tenant_id
     AND notification_event_id = v_notification_event_id;

  RETURN QUERY SELECT v_notification_event_id,v_outbox_event_id,v_delivery_count;
END;
$$;--> statement-breakpoint

REVOKE ALL ON TABLE "in_app_notification_events" FROM nexora_app;--> statement-breakpoint
REVOKE ALL ON TABLE "in_app_notification_deliveries" FROM nexora_app;--> statement-breakpoint
GRANT SELECT ON TABLE "in_app_notification_events" TO nexora_app;--> statement-breakpoint
GRANT SELECT ON TABLE "in_app_notification_deliveries" TO nexora_app;--> statement-breakpoint
GRANT UPDATE ("read_at") ON TABLE "in_app_notification_deliveries" TO nexora_app;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_emit_in_app_notification"(text,text,integer,text,text,text,text,text,text,text,text[],jsonb) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_emit_in_app_notification"(text,text,integer,text,text,text,text,text,text,text,text[],jsonb) TO nexora_app;--> statement-breakpoint
