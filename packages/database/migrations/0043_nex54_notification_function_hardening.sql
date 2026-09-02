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
    SELECT o.id
      INTO v_outbox_event_id
      FROM outbox_events o
     WHERE o.tenant_id = v_tenant_id
       AND o.idempotency_key = 'in-app:' || p_event_key;
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
    SELECT e.id
      INTO v_notification_event_id
      FROM in_app_notification_events e
     WHERE e.tenant_id = v_tenant_id
       AND e.event_key = p_event_key;
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
    ON CONFLICT ON CONSTRAINT in_app_notification_deliveries_event_user_unique DO NOTHING;
  END IF;

  SELECT count(*)::integer
    INTO v_delivery_count
    FROM in_app_notification_deliveries d
   WHERE d.tenant_id = v_tenant_id
     AND d.notification_event_id = v_notification_event_id;

  RETURN QUERY SELECT v_notification_event_id,v_outbox_event_id,v_delivery_count;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION "nexora_emit_in_app_notification"(text,text,integer,text,text,text,text,text,text,text,text[],jsonb) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_emit_in_app_notification"(text,text,integer,text,text,text,text,text,text,text,text[],jsonb) TO nexora_app;--> statement-breakpoint
