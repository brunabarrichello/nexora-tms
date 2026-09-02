CREATE TABLE "integration_clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "secret_hash" bytea NOT NULL,
  "scopes" text[] NOT NULL,
  "expires_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "created_by_user_id" uuid NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_by_user_id" uuid,
  "revoked_reason" varchar(1000),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "integration_clients_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "integration_clients_name_check" CHECK (length(trim("name")) BETWEEN 1 AND 160),
  CONSTRAINT "integration_clients_status_check" CHECK ("status" in ('active','revoked')),
  CONSTRAINT "integration_clients_secret_hash_check" CHECK (octet_length("secret_hash") = 32),
  CONSTRAINT "integration_clients_scopes_check" CHECK (
    cardinality("scopes") BETWEEN 1 AND 8
    AND "scopes" <@ ARRAY['freight.read','trips.read','documents.read']::text[]
  ),
  CONSTRAINT "integration_clients_expiry_check" CHECK ("expires_at" IS NULL OR "expires_at" > "created_at"),
  CONSTRAINT "integration_clients_revocation_check" CHECK (
    ("status" = 'active' AND "revoked_at" IS NULL AND "revoked_by_user_id" IS NULL AND "revoked_reason" IS NULL)
    OR
    ("status" = 'revoked' AND "revoked_at" IS NOT NULL AND "revoked_by_user_id" IS NOT NULL AND length(trim("revoked_reason")) >= 3)
  )
);--> statement-breakpoint

ALTER TABLE "integration_clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integration_clients" ADD CONSTRAINT "integration_clients_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_clients" ADD CONSTRAINT "integration_clients_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_clients" ADD CONSTRAINT "integration_clients_revoked_by_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_clients_tenant_status_idx" ON "integration_clients" ("tenant_id","status","created_at");--> statement-breakpoint
CREATE POLICY "integration_clients_tenant_isolation" ON "integration_clients" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

CREATE TABLE "webhook_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "integration_client_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "endpoint_url" varchar(2048) NOT NULL,
  "event_types" text[] NOT NULL,
  "api_version" integer DEFAULT 1 NOT NULL,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "signing_secret_ciphertext" text NOT NULL,
  "signing_secret_iv" varchar(64) NOT NULL,
  "signing_secret_tag" varchar(64) NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "timeout_ms" integer DEFAULT 5000 NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "updated_by_user_id" uuid NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_by_user_id" uuid,
  "revoked_reason" varchar(1000),
  "last_delivery_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "last_failure_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "webhook_subscriptions_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "webhook_subscriptions_name_check" CHECK (length(trim("name")) BETWEEN 1 AND 160),
  CONSTRAINT "webhook_subscriptions_endpoint_check" CHECK ("endpoint_url" ~ '^https://[^[:space:]]+$'),
  CONSTRAINT "webhook_subscriptions_event_types_check" CHECK (cardinality("event_types") BETWEEN 1 AND 50),
  CONSTRAINT "webhook_subscriptions_api_version_check" CHECK ("api_version" = 1),
  CONSTRAINT "webhook_subscriptions_status_check" CHECK ("status" in ('active','paused','revoked')),
  CONSTRAINT "webhook_subscriptions_max_attempts_check" CHECK ("max_attempts" BETWEEN 1 AND 10),
  CONSTRAINT "webhook_subscriptions_timeout_check" CHECK ("timeout_ms" BETWEEN 500 AND 15000),
  CONSTRAINT "webhook_subscriptions_revocation_check" CHECK (
    ("status" <> 'revoked' AND "revoked_at" IS NULL AND "revoked_by_user_id" IS NULL AND "revoked_reason" IS NULL)
    OR
    ("status" = 'revoked' AND "revoked_at" IS NOT NULL AND "revoked_by_user_id" IS NOT NULL AND length(trim("revoked_reason")) >= 3)
  )
);--> statement-breakpoint

ALTER TABLE "webhook_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_client_fk" FOREIGN KEY ("tenant_id","integration_client_id") REFERENCES "public"."integration_clients"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_updated_by_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_revoked_by_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_subscriptions_tenant_status_idx" ON "webhook_subscriptions" ("tenant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "webhook_subscriptions_tenant_client_idx" ON "webhook_subscriptions" ("tenant_id","integration_client_id","status");--> statement-breakpoint
CREATE POLICY "webhook_subscriptions_tenant_isolation" ON "webhook_subscriptions" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

CREATE TABLE "webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "subscription_id" uuid NOT NULL,
  "integration_client_id" uuid NOT NULL,
  "outbox_event_id" uuid NOT NULL,
  "durable_job_id" uuid,
  "event_type" varchar(160) NOT NULL,
  "event_version" integer NOT NULL,
  "idempotency_key" varchar(180) NOT NULL,
  "payload_fingerprint" varchar(32) NOT NULL,
  "status" varchar(24) DEFAULT 'queued' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_status_code" integer,
  "last_error" varchar(2000),
  "last_attempt_at" timestamp with time zone,
  "succeeded_at" timestamp with time zone,
  "dead_lettered_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "webhook_deliveries_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "webhook_deliveries_subscription_event_unique" UNIQUE("tenant_id","subscription_id","outbox_event_id"),
  CONSTRAINT "webhook_deliveries_tenant_idempotency_unique" UNIQUE("tenant_id","idempotency_key"),
  CONSTRAINT "webhook_deliveries_status_check" CHECK ("status" in ('queued','retry_wait','succeeded','dead_lettered','cancelled')),
  CONSTRAINT "webhook_deliveries_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "webhook_deliveries_status_code_check" CHECK ("last_status_code" IS NULL OR "last_status_code" BETWEEN 100 AND 599),
  CONSTRAINT "webhook_deliveries_terminal_check" CHECK (
    (("status" = 'succeeded') = ("succeeded_at" IS NOT NULL))
    AND (("status" = 'dead_lettered') = ("dead_lettered_at" IS NOT NULL))
    AND (("status" = 'cancelled') = ("cancelled_at" IS NOT NULL))
  )
);--> statement-breakpoint

ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscription_fk" FOREIGN KEY ("tenant_id","subscription_id") REFERENCES "public"."webhook_subscriptions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_client_fk" FOREIGN KEY ("tenant_id","integration_client_id") REFERENCES "public"."integration_clients"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_outbox_fk" FOREIGN KEY ("tenant_id","outbox_event_id") REFERENCES "public"."outbox_events"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_job_fk" FOREIGN KEY ("tenant_id","durable_job_id") REFERENCES "public"."durable_jobs"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_tenant_status_idx" ON "webhook_deliveries" ("tenant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_tenant_subscription_idx" ON "webhook_deliveries" ("tenant_id","subscription_id","created_at");--> statement-breakpoint
CREATE POLICY "webhook_deliveries_tenant_isolation" ON "webhook_deliveries" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

CREATE TABLE "webhook_delivery_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "delivery_id" uuid NOT NULL,
  "attempt" integer NOT NULL,
  "outcome" varchar(24) NOT NULL,
  "status_code" integer,
  "duration_ms" integer NOT NULL,
  "error_message" varchar(2000),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "webhook_delivery_attempts_attempt_check" CHECK ("attempt" > 0),
  CONSTRAINT "webhook_delivery_attempts_outcome_check" CHECK ("outcome" in ('success','failure','cancelled')),
  CONSTRAINT "webhook_delivery_attempts_status_code_check" CHECK ("status_code" IS NULL OR "status_code" BETWEEN 100 AND 599),
  CONSTRAINT "webhook_delivery_attempts_duration_check" CHECK ("duration_ms" >= 0)
);--> statement-breakpoint

ALTER TABLE "webhook_delivery_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_delivery_fk" FOREIGN KEY ("tenant_id","delivery_id") REFERENCES "public"."webhook_deliveries"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_delivery_attempts_tenant_delivery_idx" ON "webhook_delivery_attempts" ("tenant_id","delivery_id","created_at");--> statement-breakpoint
CREATE POLICY "webhook_delivery_attempts_tenant_isolation" ON "webhook_delivery_attempts" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

CREATE FUNCTION "nexora_authenticate_integration_client"(
  p_client_id uuid,
  p_secret_hash_hex text
)
RETURNS TABLE (
  client_id uuid,
  tenant_id uuid,
  client_name text,
  scopes text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_client integration_clients%ROWTYPE;
  v_hash bytea;
BEGIN
  IF p_client_id IS NULL OR p_secret_hash_hex IS NULL OR p_secret_hash_hex !~ '^[0-9a-fA-F]{64}$' THEN
    RETURN;
  END IF;

  v_hash := decode(lower(p_secret_hash_hex), 'hex');

  SELECT c.*
    INTO v_client
    FROM integration_clients c
   WHERE c.id = p_client_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_client.status <> 'active'
     OR (v_client.expires_at IS NOT NULL AND v_client.expires_at <= now())
     OR v_client.secret_hash <> v_hash THEN
    INSERT INTO audit_events (
      tenant_id, action, outcome, source, entity_type, entity_id,
      actor_type, actor_external_id, reason, metadata
    ) VALUES (
      v_client.tenant_id,
      'integration.api.authentication_denied',
      'denied',
      'integration',
      'integration_client',
      v_client.id::text,
      'integration',
      'integration-client:' || v_client.id::text,
      'Integration credential rejected',
      jsonb_build_object('status', v_client.status, 'expired', v_client.expires_at IS NOT NULL AND v_client.expires_at <= now())
    );
    RETURN;
  END IF;

  UPDATE integration_clients
     SET last_used_at = now(), updated_at = now()
   WHERE id = v_client.id;

  INSERT INTO audit_events (
    tenant_id, action, outcome, source, entity_type, entity_id,
    actor_type, actor_external_id, metadata
  ) VALUES (
    v_client.tenant_id,
    'integration.api.authenticated',
    'success',
    'integration',
    'integration_client',
    v_client.id::text,
    'integration',
    'integration-client:' || v_client.id::text,
    jsonb_build_object('scopes', v_client.scopes)
  );

  RETURN QUERY SELECT v_client.id, v_client.tenant_id, v_client.name::text, v_client.scopes;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_fanout_webhooks_for_outbox"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_subscription webhook_subscriptions%ROWTYPE;
  v_delivery_id uuid;
  v_job_id uuid;
  v_key text;
BEGIN
  FOR v_subscription IN
    SELECT s.*
      FROM webhook_subscriptions s
      JOIN integration_clients c
        ON c.tenant_id = s.tenant_id
       AND c.id = s.integration_client_id
     WHERE s.tenant_id = NEW.tenant_id
       AND s.status = 'active'
       AND c.status = 'active'
       AND (c.expires_at IS NULL OR c.expires_at > now())
       AND s.event_types @> ARRAY[NEW.event_type]::text[]
  LOOP
    v_delivery_id := gen_random_uuid();
    v_key := 'webhook:' || v_subscription.id::text || ':' || NEW.id::text;

    INSERT INTO webhook_deliveries (
      id, tenant_id, subscription_id, integration_client_id, outbox_event_id,
      event_type, event_version, idempotency_key, payload_fingerprint
    ) VALUES (
      v_delivery_id,
      NEW.tenant_id,
      v_subscription.id,
      v_subscription.integration_client_id,
      NEW.id,
      NEW.event_type,
      NEW.event_version,
      v_key,
      md5(NEW.payload::text)
    ) ON CONFLICT (tenant_id, subscription_id, outbox_event_id) DO NOTHING
    RETURNING id INTO v_delivery_id;

    IF v_delivery_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO durable_jobs (
      tenant_id, source_outbox_event_id, job_type, payload, status,
      idempotency_key, correlation_id, request_id, run_at, max_attempts
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      'integrations.webhook.deliver',
      jsonb_build_object('deliveryId', v_delivery_id),
      'pending',
      v_key,
      NEW.correlation_id,
      NEW.request_id,
      now(),
      v_subscription.max_attempts
    )
    RETURNING id INTO v_job_id;

    UPDATE webhook_deliveries
       SET durable_job_id = v_job_id, updated_at = now()
     WHERE id = v_delivery_id;

    INSERT INTO audit_events (
      tenant_id, action, outcome, source, entity_type, entity_id,
      actor_type, correlation_id, request_id, idempotency_key, metadata
    ) VALUES (
      NEW.tenant_id,
      'integration.webhook.queued',
      'success',
      'integration',
      'webhook_delivery',
      v_delivery_id::text,
      'system',
      NEW.correlation_id,
      NEW.request_id,
      v_key,
      jsonb_build_object(
        'subscriptionId', v_subscription.id,
        'integrationClientId', v_subscription.integration_client_id,
        'eventType', NEW.event_type,
        'eventVersion', NEW.event_version
      )
    );

    v_delivery_id := NULL;
  END LOOP;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "outbox_events_webhook_fanout"
AFTER INSERT ON "outbox_events"
FOR EACH ROW EXECUTE FUNCTION "nexora_fanout_webhooks_for_outbox"();--> statement-breakpoint

CREATE FUNCTION "nexora_worker_get_webhook_delivery"(p_delivery_id uuid)
RETURNS TABLE (
  delivery_id uuid,
  tenant_id uuid,
  subscription_id uuid,
  integration_client_id uuid,
  subscription_status text,
  client_status text,
  endpoint_url text,
  signing_secret_ciphertext text,
  signing_secret_iv text,
  signing_secret_tag text,
  timeout_ms integer,
  event_id uuid,
  event_type text,
  event_version integer,
  occurred_at timestamp with time zone,
  event_payload jsonb,
  idempotency_key text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    d.id,
    d.tenant_id,
    s.id,
    c.id,
    s.status::text,
    c.status::text,
    s.endpoint_url::text,
    s.signing_secret_ciphertext,
    s.signing_secret_iv,
    s.signing_secret_tag,
    s.timeout_ms,
    e.id,
    e.event_type::text,
    e.event_version,
    e.occurred_at,
    e.payload,
    d.idempotency_key::text
  FROM webhook_deliveries d
  JOIN webhook_subscriptions s
    ON s.tenant_id = d.tenant_id AND s.id = d.subscription_id
  JOIN integration_clients c
    ON c.tenant_id = d.tenant_id AND c.id = d.integration_client_id
  JOIN outbox_events e
    ON e.tenant_id = d.tenant_id AND e.id = d.outbox_event_id
  WHERE d.id = p_delivery_id
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_worker_record_webhook_attempt"(
  p_delivery_id uuid,
  p_attempt integer,
  p_outcome text,
  p_status_code integer,
  p_duration_ms integer,
  p_error_message text,
  p_terminal boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_delivery webhook_deliveries%ROWTYPE;
  v_action text;
  v_status text;
BEGIN
  IF p_attempt < 1 OR p_outcome NOT IN ('success','failure','cancelled') OR p_duration_ms < 0 THEN
    RAISE EXCEPTION 'invalid webhook attempt payload' USING ERRCODE = '22023';
  END IF;
  IF p_status_code IS NOT NULL AND (p_status_code < 100 OR p_status_code > 599) THEN
    RAISE EXCEPTION 'invalid webhook status code' USING ERRCODE = '22023';
  END IF;

  SELECT d.* INTO v_delivery
    FROM webhook_deliveries d
   WHERE d.id = p_delivery_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO webhook_delivery_attempts (
    tenant_id, delivery_id, attempt, outcome, status_code, duration_ms, error_message
  ) VALUES (
    v_delivery.tenant_id,
    v_delivery.id,
    p_attempt,
    p_outcome,
    p_status_code,
    p_duration_ms,
    CASE WHEN p_error_message IS NULL THEN NULL ELSE left(p_error_message, 2000) END
  );

  v_status := CASE
    WHEN p_outcome = 'success' THEN 'succeeded'
    WHEN p_outcome = 'cancelled' THEN 'cancelled'
    WHEN coalesce(p_terminal, false) THEN 'dead_lettered'
    ELSE 'retry_wait'
  END;

  UPDATE webhook_deliveries
     SET status = v_status,
         attempts = attempts + 1,
         last_status_code = p_status_code,
         last_error = CASE WHEN p_outcome = 'failure' THEN left(coalesce(p_error_message, 'webhook delivery failed'), 2000) ELSE NULL END,
         last_attempt_at = now(),
         succeeded_at = CASE WHEN v_status = 'succeeded' THEN now() ELSE NULL END,
         dead_lettered_at = CASE WHEN v_status = 'dead_lettered' THEN now() ELSE NULL END,
         cancelled_at = CASE WHEN v_status = 'cancelled' THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = v_delivery.id;

  UPDATE webhook_subscriptions
     SET last_delivery_at = now(),
         last_success_at = CASE WHEN p_outcome = 'success' THEN now() ELSE last_success_at END,
         last_failure_at = CASE WHEN p_outcome = 'failure' THEN now() ELSE last_failure_at END,
         updated_at = now()
   WHERE tenant_id = v_delivery.tenant_id
     AND id = v_delivery.subscription_id;

  v_action := CASE
    WHEN p_outcome = 'success' THEN 'integration.webhook.delivery_succeeded'
    WHEN p_outcome = 'cancelled' THEN 'integration.webhook.delivery_cancelled'
    ELSE 'integration.webhook.delivery_failed'
  END;

  INSERT INTO audit_events (
    tenant_id, action, outcome, source, entity_type, entity_id,
    actor_type, actor_external_id, idempotency_key, reason, metadata
  ) VALUES (
    v_delivery.tenant_id,
    v_action,
    CASE WHEN p_outcome = 'success' THEN 'success' WHEN p_outcome = 'cancelled' THEN 'partial' ELSE 'failure' END,
    'worker',
    'webhook_delivery',
    v_delivery.id::text,
    'service',
    'nexora-worker-webhook',
    v_delivery.idempotency_key,
    CASE WHEN p_error_message IS NULL THEN NULL ELSE left(p_error_message, 1500) END,
    jsonb_build_object(
      'subscriptionId', v_delivery.subscription_id,
      'integrationClientId', v_delivery.integration_client_id,
      'attempt', p_attempt,
      'statusCode', p_status_code,
      'terminal', coalesce(p_terminal, false)
    )
  );

  RETURN true;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_sync_webhook_delivery_from_job"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.job_type <> 'integrations.webhook.deliver' OR NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  UPDATE webhook_deliveries
     SET status = CASE
           WHEN NEW.status = 'pending' THEN 'queued'
           WHEN NEW.status = 'retry_wait' THEN 'retry_wait'
           WHEN NEW.status = 'succeeded' THEN 'succeeded'
           WHEN NEW.status = 'dead_lettered' THEN 'dead_lettered'
           WHEN NEW.status = 'cancelled' THEN 'cancelled'
           ELSE status
         END,
         succeeded_at = CASE WHEN NEW.status = 'succeeded' THEN coalesce(succeeded_at, now()) ELSE succeeded_at END,
         dead_lettered_at = CASE WHEN NEW.status = 'dead_lettered' THEN coalesce(dead_lettered_at, now()) WHEN NEW.status = 'pending' THEN NULL ELSE dead_lettered_at END,
         cancelled_at = CASE WHEN NEW.status = 'cancelled' THEN coalesce(cancelled_at, now()) WHEN NEW.status = 'pending' THEN NULL ELSE cancelled_at END,
         updated_at = now()
   WHERE tenant_id = NEW.tenant_id
     AND durable_job_id = NEW.id;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "durable_jobs_webhook_delivery_sync"
AFTER UPDATE OF status ON "durable_jobs"
FOR EACH ROW EXECUTE FUNCTION "nexora_sync_webhook_delivery_from_job"();--> statement-breakpoint

REVOKE ALL ON FUNCTION "nexora_authenticate_integration_client"(uuid, text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_fanout_webhooks_for_outbox"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_worker_get_webhook_delivery"(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_worker_record_webhook_attempt"(uuid, integer, text, integer, integer, text, boolean) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_sync_webhook_delivery_from_job"() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_authenticate_integration_client"(uuid, text) TO nexora_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_worker_get_webhook_delivery"(uuid) TO nexora_worker;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_worker_record_webhook_attempt"(uuid, integer, text, integer, integer, text, boolean) TO nexora_worker;--> statement-breakpoint

GRANT SELECT (id, tenant_id, name, status, scopes, expires_at, last_used_at, created_by_user_id, revoked_at, revoked_by_user_id, revoked_reason, created_at, updated_at) ON TABLE "integration_clients" TO nexora_app;--> statement-breakpoint
GRANT INSERT (id, tenant_id, name, status, secret_hash, scopes, expires_at, created_by_user_id, created_at, updated_at) ON TABLE "integration_clients" TO nexora_app;--> statement-breakpoint
GRANT UPDATE (status, scopes, expires_at, revoked_at, revoked_by_user_id, revoked_reason, updated_at) ON TABLE "integration_clients" TO nexora_app;--> statement-breakpoint
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "integration_clients" FROM nexora_app;--> statement-breakpoint

GRANT SELECT (id, tenant_id, integration_client_id, name, endpoint_url, event_types, api_version, status, max_attempts, timeout_ms, created_by_user_id, updated_by_user_id, revoked_at, revoked_by_user_id, revoked_reason, last_delivery_at, last_success_at, last_failure_at, created_at, updated_at) ON TABLE "webhook_subscriptions" TO nexora_app;--> statement-breakpoint
GRANT INSERT (id, tenant_id, integration_client_id, name, endpoint_url, event_types, api_version, status, signing_secret_ciphertext, signing_secret_iv, signing_secret_tag, max_attempts, timeout_ms, created_by_user_id, updated_by_user_id, created_at, updated_at) ON TABLE "webhook_subscriptions" TO nexora_app;--> statement-breakpoint
GRANT UPDATE (name, endpoint_url, event_types, status, max_attempts, timeout_ms, updated_by_user_id, revoked_at, revoked_by_user_id, revoked_reason, updated_at) ON TABLE "webhook_subscriptions" TO nexora_app;--> statement-breakpoint
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "webhook_subscriptions" FROM nexora_app;--> statement-breakpoint

GRANT SELECT ON TABLE "webhook_deliveries", "webhook_delivery_attempts" TO nexora_app;--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "webhook_deliveries", "webhook_delivery_attempts" FROM nexora_app;--> statement-breakpoint
REVOKE ALL ON TABLE "integration_clients", "webhook_subscriptions", "webhook_deliveries", "webhook_delivery_attempts" FROM nexora_worker;