ALTER TABLE "communication_preferences"
  ADD CONSTRAINT "communication_preferences_enabled_consent_check"
  CHECK (NOT "enabled" OR "consent_status"='granted');--> statement-breakpoint

REVOKE SELECT ON TABLE "outbound_communications" FROM nexora_app;--> statement-breakpoint
GRANT SELECT (
  "id","tenant_id","template_id","template_key","template_version","channel","recipient_type","recipient_id",
  "provider_code","status","blocked_reason","last_error","outbox_event_id","durable_job_id","idempotency_key",
  "created_by_user_id","created_at","updated_at","sent_at"
) ON TABLE "outbound_communications" TO nexora_app;--> statement-breakpoint

REVOKE ALL ON TABLE "communication_provider_routes" FROM nexora_worker;--> statement-breakpoint
REVOKE ALL ON TABLE "communication_templates" FROM nexora_worker;--> statement-breakpoint
REVOKE ALL ON TABLE "communication_preferences" FROM nexora_worker;--> statement-breakpoint
REVOKE ALL ON TABLE "outbound_communications" FROM nexora_worker;--> statement-breakpoint
REVOKE ALL ON TABLE "outbound_communication_attempts" FROM nexora_worker;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_upsert_communication_preference"(
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
  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'tenant and user context are required' USING ERRCODE='42501';
  END IF;
  IF p_recipient_type NOT IN ('driver','party_contact')
     OR p_channel NOT IN ('email','whatsapp','sms')
     OR p_consent_status NOT IN ('granted','denied','unknown') THEN
    RAISE EXCEPTION 'invalid communication preference' USING ERRCODE='22023';
  END IF;
  IF p_enabled AND p_consent_status <> 'granted' THEN
    RAISE EXCEPTION 'enabled communication channel requires granted consent' USING ERRCODE='22023';
  END IF;
  IF p_policy_version IS NULL OR length(trim(p_policy_version)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'policy version is required' USING ERRCODE='22023';
  END IF;
  IF p_consent_status = 'granted'
     AND (p_consented_at IS NULL OR p_consent_source IS NULL OR length(trim(p_consent_source)) < 2) THEN
    RAISE EXCEPTION 'granted consent requires source and timestamp' USING ERRCODE='22023';
  END IF;

  v_destination := nexora_resolve_communication_destination(p_recipient_type,p_recipient_id,p_channel);
  IF v_destination IS NULL THEN
    RAISE EXCEPTION 'recipient does not have an active destination for this channel' USING ERRCODE='22023';
  END IF;

  INSERT INTO communication_preferences (
    tenant_id,recipient_type,recipient_id,channel,enabled,consent_status,consent_source,consented_at,
    policy_version,updated_by_user_id
  ) VALUES (
    v_tenant_id,p_recipient_type,p_recipient_id,p_channel,p_enabled,p_consent_status,p_consent_source,
    p_consented_at,trim(p_policy_version),v_user_id
  )
  ON CONFLICT (tenant_id,recipient_type,recipient_id,channel) DO UPDATE SET
    enabled=excluded.enabled,
    consent_status=excluded.consent_status,
    consent_source=excluded.consent_source,
    consented_at=excluded.consented_at,
    policy_version=excluded.policy_version,
    updated_by_user_id=v_user_id,
    updated_at=now()
  RETURNING id INTO v_id;

  INSERT INTO audit_events (
    tenant_id,action,outcome,source,entity_type,entity_id,actor_type,actor_user_id,metadata
  ) VALUES (
    v_tenant_id,'notification.preference.updated','success','api','communication_preference',v_id::text,
    'user',v_user_id,
    jsonb_build_object(
      'recipientType',p_recipient_type,'recipientId',p_recipient_id,'channel',p_channel,
      'enabled',p_enabled,'consentStatus',p_consent_status,'policyVersion',p_policy_version
    )
  );
  RETURN v_id;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_queue_communication"(
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
  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'tenant and user context are required' USING ERRCODE='42501';
  END IF;
  IF p_recipient_type NOT IN ('driver','party_contact')
     OR p_idempotency_key IS NULL
     OR length(trim(p_idempotency_key)) NOT BETWEEN 3 AND 180
     OR p_max_attempts NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'invalid communication request metadata' USING ERRCODE='22023';
  END IF;
  IF p_variables IS NULL THEN p_variables := '{}'::jsonb; END IF;
  IF jsonb_typeof(p_variables) <> 'object' THEN
    RAISE EXCEPTION 'communication variables must be a JSON object' USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || trim(p_idempotency_key),0));

  SELECT c.* INTO v_existing
    FROM outbound_communications c
   WHERE c.tenant_id=v_tenant_id AND c.idempotency_key=trim(p_idempotency_key);
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id,v_existing.durable_job_id,v_existing.status::text,v_existing.blocked_reason::text;
    RETURN;
  END IF;

  SELECT t.* INTO v_template
    FROM communication_templates t
   WHERE t.tenant_id=v_tenant_id AND t.id=p_template_id AND t.status='active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'active communication template not found' USING ERRCODE='P0002';
  END IF;

  v_subject := v_template.subject_template;
  v_body := v_template.body_template;
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each_text(p_variables) LOOP
    v_body := replace(v_body,'{{' || v_key || '}}',v_value);
    IF v_subject IS NOT NULL THEN
      v_subject := replace(v_subject,'{{' || v_key || '}}',v_value);
    END IF;
  END LOOP;
  IF v_body ~ '\{\{[A-Za-z0-9_.-]+\}\}' OR coalesce(v_subject,'') ~ '\{\{[A-Za-z0-9_.-]+\}\}' THEN
    RAISE EXCEPTION 'communication template contains unresolved variables' USING ERRCODE='22023';
  END IF;

  SELECT p.* INTO v_preference
    FROM communication_preferences p
   WHERE p.tenant_id=v_tenant_id
     AND p.recipient_type=p_recipient_type
     AND p.recipient_id=p_recipient_id
     AND p.channel=v_template.channel;
  IF NOT FOUND OR NOT v_preference.enabled OR v_preference.consent_status <> 'granted' THEN
    v_blocked_reason := 'channel_preference_not_granted';
  END IF;

  IF v_blocked_reason IS NULL THEN
    v_destination := nexora_resolve_communication_destination(p_recipient_type,p_recipient_id,v_template.channel);
    IF v_destination IS NULL THEN
      v_blocked_reason := 'destination_unavailable';
    END IF;
  END IF;

  IF v_blocked_reason IS NULL THEN
    SELECT r.* INTO v_provider
      FROM communication_provider_routes r
     WHERE r.tenant_id=v_tenant_id
       AND r.channel=v_template.channel
       AND r.status='active';
    IF NOT FOUND THEN
      v_blocked_reason := 'provider_not_configured';
    END IF;
  END IF;

  v_communication_id := gen_random_uuid();
  IF v_blocked_reason IS NOT NULL THEN
    INSERT INTO outbound_communications (
      id,tenant_id,template_id,template_key,template_version,channel,recipient_type,recipient_id,
      destination,provider_code,variables,rendered_subject,rendered_body,status,blocked_reason,
      idempotency_key,created_by_user_id
    ) VALUES (
      v_communication_id,v_tenant_id,v_template.id,v_template.template_key,v_template.version,
      v_template.channel,p_recipient_type,p_recipient_id,v_destination,
      CASE WHEN v_provider.id IS NULL THEN NULL ELSE v_provider.provider_code END,
      p_variables,v_subject,v_body,'blocked',v_blocked_reason,trim(p_idempotency_key),v_user_id
    );
    INSERT INTO audit_events (
      tenant_id,action,outcome,source,entity_type,entity_id,actor_type,actor_user_id,idempotency_key,reason,metadata
    ) VALUES (
      v_tenant_id,'notification.communication.blocked','denied','api','outbound_communication',
      v_communication_id::text,'user',v_user_id,trim(p_idempotency_key),v_blocked_reason,
      jsonb_build_object(
        'channel',v_template.channel,'recipientType',p_recipient_type,'recipientId',p_recipient_id,
        'templateKey',v_template.template_key,'templateVersion',v_template.version
      )
    );
    RETURN QUERY SELECT v_communication_id,NULL::uuid,'blocked'::text,v_blocked_reason;
    RETURN;
  END IF;

  INSERT INTO outbox_events (
    tenant_id,aggregate_type,aggregate_id,event_type,event_version,payload,idempotency_key,available_at,max_attempts
  ) VALUES (
    v_tenant_id,'outbound_communication',v_communication_id::text,'notifications.communication.queued',1,
    jsonb_build_object(
      'communicationId',v_communication_id,'channel',v_template.channel,'recipientType',p_recipient_type,
      'recipientId',p_recipient_id,'templateKey',v_template.template_key,'templateVersion',v_template.version
    ),
    'communication-outbox:' || v_communication_id::text,now(),10
  ) RETURNING id INTO v_outbox_id;

  INSERT INTO outbound_communications (
    id,tenant_id,template_id,template_key,template_version,channel,recipient_type,recipient_id,
    destination,provider_code,variables,rendered_subject,rendered_body,status,outbox_event_id,
    idempotency_key,created_by_user_id
  ) VALUES (
    v_communication_id,v_tenant_id,v_template.id,v_template.template_key,v_template.version,
    v_template.channel,p_recipient_type,p_recipient_id,v_destination,v_provider.provider_code,
    p_variables,v_subject,v_body,'queued',v_outbox_id,trim(p_idempotency_key),v_user_id
  );

  INSERT INTO durable_jobs (
    tenant_id,source_outbox_event_id,job_type,payload,status,idempotency_key,run_at,max_attempts
  ) VALUES (
    v_tenant_id,v_outbox_id,'notifications.communication.deliver',
    jsonb_build_object('communicationId',v_communication_id),'pending',
    'communication:' || v_communication_id::text,now(),p_max_attempts
  ) RETURNING id INTO v_job_id;

  UPDATE outbound_communications
     SET durable_job_id=v_job_id,updated_at=now()
   WHERE id=v_communication_id;

  INSERT INTO audit_events (
    tenant_id,action,outcome,source,entity_type,entity_id,actor_type,actor_user_id,idempotency_key,metadata
  ) VALUES (
    v_tenant_id,'notification.communication.queued','success','api','outbound_communication',
    v_communication_id::text,'user',v_user_id,trim(p_idempotency_key),
    jsonb_build_object(
      'channel',v_template.channel,'providerCode',v_provider.provider_code,'recipientType',p_recipient_type,
      'recipientId',p_recipient_id,'templateKey',v_template.template_key,
      'templateVersion',v_template.version,'durableJobId',v_job_id
    )
  );

  RETURN QUERY SELECT v_communication_id,v_job_id,'queued'::text,NULL::text;
END;
$$;--> statement-breakpoint
