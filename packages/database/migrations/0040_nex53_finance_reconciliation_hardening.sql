ALTER TABLE "financial_reconciliation_entries"
  ADD CONSTRAINT "financial_reconciliation_entries_suggested_status_check"
  CHECK ("status" <> 'suggested' OR ("suggested_target_type" IS NOT NULL AND "suggested_target_id" IS NOT NULL AND "suggested_score" IS NOT NULL));--> statement-breakpoint

REVOKE INSERT ON TABLE "financial_reconciliation_events" FROM nexora_app;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_record_finance_reconciliation_event"(
  p_entry_id uuid,
  p_match_id uuid,
  p_event_type varchar,
  p_payload jsonb,
  p_actor_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_tenant_id uuid := nullif(current_setting('app.tenant_id',true),'')::uuid;
  v_user_id uuid := nullif(current_setting('app.user_id',true),'')::uuid;
  v_id uuid;
BEGIN
  IF v_tenant_id IS NULL OR v_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'reconciliation audit context is invalid' USING ERRCODE='P0001';
  END IF;
  IF p_event_type NOT IN ('entry_imported','matching_attempted','entry_ignored','reconciled','reconciliation_reversed') THEN
    RAISE EXCEPTION 'unsupported reconciliation event type' USING ERRCODE='P0001';
  END IF;
  IF p_entry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM financial_reconciliation_entries e WHERE e.tenant_id=v_tenant_id AND e.id=p_entry_id
  ) THEN
    RAISE EXCEPTION 'reconciliation audit entry is outside current tenant' USING ERRCODE='P0001';
  END IF;
  IF p_match_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM financial_reconciliation_matches m WHERE m.tenant_id=v_tenant_id AND m.id=p_match_id
  ) THEN
    RAISE EXCEPTION 'reconciliation audit match is outside current tenant' USING ERRCODE='P0001';
  END IF;

  INSERT INTO financial_reconciliation_events(tenant_id,entry_id,match_id,event_type,payload,actor_user_id)
  VALUES (v_tenant_id,p_entry_id,p_match_id,p_event_type,coalesce(p_payload,'{}'::jsonb),p_actor_user_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_record_finance_reconciliation_event"(uuid,uuid,varchar,jsonb,uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_record_finance_reconciliation_event"(uuid,uuid,varchar,jsonb,uuid) TO nexora_app;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_finance_reconciliation_entry_guard"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'financial reconciliation entries cannot be deleted' USING ERRCODE='P0001';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.import_id IS DISTINCT FROM OLD.import_id
       OR NEW.external_id IS DISTINCT FROM OLD.external_id
       OR NEW.direction IS DISTINCT FROM OLD.direction
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
       OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
       OR NEW.reference IS DISTINCT FROM OLD.reference
       OR NEW.counterparty_name IS DISTINCT FROM OLD.counterparty_name
       OR NEW.raw_payload IS DISTINCT FROM OLD.raw_payload
       OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'financial reconciliation imported entry identity is immutable' USING ERRCODE='P0001';
    END IF;

    IF OLD.status='ignored' AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'ignored reconciliation entry is terminal' USING ERRCODE='P0001';
    END IF;

    IF OLD.status='reconciled' AND NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status <> 'divergent'
         OR EXISTS (SELECT 1 FROM financial_reconciliation_matches m WHERE m.tenant_id=NEW.tenant_id AND m.entry_id=NEW.id AND m.status='active')
         OR NOT EXISTS (SELECT 1 FROM financial_reconciliation_matches m WHERE m.tenant_id=NEW.tenant_id AND m.entry_id=NEW.id AND m.status='reversed') THEN
        RAISE EXCEPTION 'reconciled entry can reopen only after append-only reconciliation reversal' USING ERRCODE='P0001';
      END IF;
    END IF;

    IF NEW.status='reconciled' AND NOT EXISTS (
      SELECT 1 FROM financial_reconciliation_matches m WHERE m.tenant_id=NEW.tenant_id AND m.entry_id=NEW.id AND m.status='active'
    ) THEN
      RAISE EXCEPTION 'reconciled entry requires an active reconciliation match' USING ERRCODE='P0001';
    END IF;

    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_finance_reconciliation_entry_guard"() FROM PUBLIC;