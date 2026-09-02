CREATE TABLE "financial_reconciliation_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "source" varchar(40) NOT NULL,
  "provider" varchar(80),
  "external_batch_id" varchar(160),
  "account_reference" varchar(160),
  "period_start" date,
  "period_end" date,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "financial_reconciliation_imports_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "financial_reconciliation_imports_source_check" CHECK (length(trim("source")) > 0),
  CONSTRAINT "financial_reconciliation_imports_period_check" CHECK ("period_start" IS NULL OR "period_end" IS NULL OR "period_end" >= "period_start")
);--> statement-breakpoint
ALTER TABLE "financial_reconciliation_imports" ADD CONSTRAINT "financial_reconciliation_imports_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reconciliation_imports" ADD CONSTRAINT "financial_reconciliation_imports_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_reconciliation_imports_external_unique" ON "financial_reconciliation_imports" USING btree ("tenant_id","source","external_batch_id") WHERE "external_batch_id" IS NOT NULL;--> statement-breakpoint

CREATE TABLE "financial_reconciliation_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "import_id" uuid NOT NULL,
  "external_id" varchar(160),
  "direction" varchar(12) NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "currency_code" varchar(3) NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "reference" varchar(300),
  "counterparty_name" varchar(200),
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "suggested_target_type" varchar(32),
  "suggested_target_id" uuid,
  "suggested_score" integer,
  "suggestion_reason" varchar(500),
  "raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "financial_reconciliation_entries_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "financial_reconciliation_entries_direction_check" CHECK ("direction" IN ('credit','debit')),
  CONSTRAINT "financial_reconciliation_entries_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "financial_reconciliation_entries_currency_check" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "financial_reconciliation_entries_status_check" CHECK ("status" IN ('pending','suggested','divergent','reconciled','ignored')),
  CONSTRAINT "financial_reconciliation_entries_suggestion_check" CHECK (
    ("suggested_target_type" IS NULL AND "suggested_target_id" IS NULL AND "suggested_score" IS NULL)
    OR
    ("suggested_target_type" IN ('customer_receivable','carrier_payment') AND "suggested_target_id" IS NOT NULL AND "suggested_score" BETWEEN 0 AND 100)
  )
);--> statement-breakpoint
ALTER TABLE "financial_reconciliation_entries" ADD CONSTRAINT "financial_reconciliation_entries_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reconciliation_entries" ADD CONSTRAINT "financial_reconciliation_entries_import_fk" FOREIGN KEY ("tenant_id","import_id") REFERENCES "public"."financial_reconciliation_imports"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reconciliation_entries" ADD CONSTRAINT "financial_reconciliation_entries_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_reconciliation_entries_external_unique" ON "financial_reconciliation_entries" USING btree ("tenant_id","import_id","external_id") WHERE "external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "financial_reconciliation_entries_queue_idx" ON "financial_reconciliation_entries" USING btree ("tenant_id","status","occurred_at");--> statement-breakpoint

CREATE TABLE "financial_reconciliation_matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "entry_id" uuid NOT NULL,
  "target_type" varchar(32) NOT NULL,
  "target_id" uuid NOT NULL,
  "ledger_transaction_id" uuid NOT NULL,
  "match_method" varchar(24) NOT NULL,
  "score" integer,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "reversal_transaction_id" uuid,
  "matched_by_user_id" uuid NOT NULL,
  "matched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reversed_by_user_id" uuid,
  "reversed_at" timestamp with time zone,
  "reverse_reason" varchar(1000),
  CONSTRAINT "financial_reconciliation_matches_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "financial_reconciliation_matches_target_check" CHECK ("target_type" IN ('customer_receivable','carrier_payment')),
  CONSTRAINT "financial_reconciliation_matches_method_check" CHECK ("match_method" IN ('suggested','manual')),
  CONSTRAINT "financial_reconciliation_matches_score_check" CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 100),
  CONSTRAINT "financial_reconciliation_matches_status_check" CHECK ("status" IN ('active','reversed')),
  CONSTRAINT "financial_reconciliation_matches_reversal_check" CHECK (
    ("status"='active' AND "reversal_transaction_id" IS NULL AND "reversed_by_user_id" IS NULL AND "reversed_at" IS NULL AND "reverse_reason" IS NULL)
    OR
    ("status"='reversed' AND "reversal_transaction_id" IS NOT NULL AND "reversed_by_user_id" IS NOT NULL AND "reversed_at" IS NOT NULL AND "reverse_reason" IS NOT NULL AND length(trim("reverse_reason")) > 0)
  )
);--> statement-breakpoint
ALTER TABLE "financial_reconciliation_matches" ADD CONSTRAINT "financial_reconciliation_matches_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reconciliation_matches" ADD CONSTRAINT "financial_reconciliation_matches_entry_fk" FOREIGN KEY ("tenant_id","entry_id") REFERENCES "public"."financial_reconciliation_entries"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reconciliation_matches" ADD CONSTRAINT "financial_reconciliation_matches_matched_by_fk" FOREIGN KEY ("matched_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reconciliation_matches" ADD CONSTRAINT "financial_reconciliation_matches_reversed_by_fk" FOREIGN KEY ("reversed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_reconciliation_matches_active_entry_unique" ON "financial_reconciliation_matches" USING btree ("tenant_id","entry_id") WHERE "status"='active';--> statement-breakpoint
CREATE INDEX "financial_reconciliation_matches_target_idx" ON "financial_reconciliation_matches" USING btree ("tenant_id","target_type","target_id");--> statement-breakpoint

CREATE TABLE "financial_reconciliation_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "entry_id" uuid,
  "match_id" uuid,
  "event_type" varchar(40) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "financial_reconciliation_events_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "financial_reconciliation_events_type_check" CHECK ("event_type" IN ('entry_imported','matching_attempted','entry_ignored','reconciled','reconciliation_reversed'))
);--> statement-breakpoint
ALTER TABLE "financial_reconciliation_events" ADD CONSTRAINT "financial_reconciliation_events_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reconciliation_events" ADD CONSTRAINT "financial_reconciliation_events_entry_fk" FOREIGN KEY ("tenant_id","entry_id") REFERENCES "public"."financial_reconciliation_entries"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reconciliation_events" ADD CONSTRAINT "financial_reconciliation_events_match_fk" FOREIGN KEY ("tenant_id","match_id") REFERENCES "public"."financial_reconciliation_matches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reconciliation_events" ADD CONSTRAINT "financial_reconciliation_events_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "financial_reconciliation_events_entry_time_idx" ON "financial_reconciliation_events" USING btree ("tenant_id","entry_id","created_at");--> statement-breakpoint

ALTER TABLE "financial_reconciliation_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_reconciliation_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_reconciliation_matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_reconciliation_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "financial_reconciliation_imports_tenant_isolation" ON "financial_reconciliation_imports" AS PERMISSIVE FOR ALL TO public USING ("tenant_id"=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK ("tenant_id"=nullif(current_setting('app.tenant_id',true),'')::uuid);--> statement-breakpoint
CREATE POLICY "financial_reconciliation_entries_tenant_isolation" ON "financial_reconciliation_entries" AS PERMISSIVE FOR ALL TO public USING ("tenant_id"=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK ("tenant_id"=nullif(current_setting('app.tenant_id',true),'')::uuid);--> statement-breakpoint
CREATE POLICY "financial_reconciliation_matches_tenant_isolation" ON "financial_reconciliation_matches" AS PERMISSIVE FOR ALL TO public USING ("tenant_id"=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK ("tenant_id"=nullif(current_setting('app.tenant_id',true),'')::uuid);--> statement-breakpoint
CREATE POLICY "financial_reconciliation_events_tenant_isolation" ON "financial_reconciliation_events" AS PERMISSIVE FOR ALL TO public USING ("tenant_id"=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK ("tenant_id"=nullif(current_setting('app.tenant_id',true),'')::uuid);--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_finance_reconciliation_import_guard"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'financial reconciliation imports are immutable' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER "financial_reconciliation_imports_immutable" BEFORE UPDATE OR DELETE ON "financial_reconciliation_imports" FOR EACH ROW EXECUTE FUNCTION "nexora_finance_reconciliation_import_guard"();--> statement-breakpoint

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
    IF OLD.status IN ('reconciled','ignored') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'terminal reconciliation entry status cannot be rewritten' USING ERRCODE='P0001';
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER "financial_reconciliation_entries_guard" BEFORE UPDATE OR DELETE ON "financial_reconciliation_entries" FOR EACH ROW EXECUTE FUNCTION "nexora_finance_reconciliation_entry_guard"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_finance_reconciliation_match_guard"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_entry record;
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'financial reconciliation matches cannot be deleted' USING ERRCODE='P0001';
  END IF;
  SELECT direction,status INTO v_entry FROM financial_reconciliation_entries WHERE tenant_id=NEW.tenant_id AND id=NEW.entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'reconciliation entry not found' USING ERRCODE='P0001'; END IF;
  IF TG_OP='INSERT' THEN
    IF v_entry.status='reconciled' THEN RAISE EXCEPTION 'reconciliation entry is already reconciled' USING ERRCODE='P0001'; END IF;
    IF (NEW.target_type='customer_receivable' AND v_entry.direction <> 'credit') OR (NEW.target_type='carrier_payment' AND v_entry.direction <> 'debit') THEN
      RAISE EXCEPTION 'reconciliation target type does not match entry direction' USING ERRCODE='P0001';
    END IF;
    IF NEW.target_type='customer_receivable' THEN
      IF NOT EXISTS (SELECT 1 FROM customer_receivable_transactions t WHERE t.tenant_id=NEW.tenant_id AND t.id=NEW.ledger_transaction_id AND t.receivable_id=NEW.target_id AND t.kind='receipt') THEN
        RAISE EXCEPTION 'reconciliation must reference a receipt transaction for target receivable' USING ERRCODE='P0001';
      END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM carrier_payment_transactions t WHERE t.tenant_id=NEW.tenant_id AND t.id=NEW.ledger_transaction_id AND t.obligation_id=NEW.target_id AND t.kind IN ('advance','payment')) THEN
        RAISE EXCEPTION 'reconciliation must reference a carrier payment transaction for target obligation' USING ERRCODE='P0001';
      END IF;
    END IF;
  ELSE
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.entry_id IS DISTINCT FROM OLD.entry_id OR NEW.target_type IS DISTINCT FROM OLD.target_type OR NEW.target_id IS DISTINCT FROM OLD.target_id OR NEW.ledger_transaction_id IS DISTINCT FROM OLD.ledger_transaction_id OR NEW.match_method IS DISTINCT FROM OLD.match_method OR NEW.score IS DISTINCT FROM OLD.score OR NEW.matched_by_user_id IS DISTINCT FROM OLD.matched_by_user_id OR NEW.matched_at IS DISTINCT FROM OLD.matched_at THEN
      RAISE EXCEPTION 'reconciliation match identity is immutable' USING ERRCODE='P0001';
    END IF;
    IF OLD.status='reversed' THEN RAISE EXCEPTION 'reversed reconciliation match is immutable' USING ERRCODE='P0001'; END IF;
    IF NEW.status='reversed' THEN
      IF NEW.target_type='customer_receivable' THEN
        IF NOT EXISTS (SELECT 1 FROM customer_receivable_transactions t WHERE t.tenant_id=NEW.tenant_id AND t.id=NEW.reversal_transaction_id AND t.receivable_id=NEW.target_id AND t.kind='reversal' AND t.related_transaction_id=OLD.ledger_transaction_id) THEN
          RAISE EXCEPTION 'reconciliation reversal must reference the original receipt' USING ERRCODE='P0001';
        END IF;
      ELSE
        IF NOT EXISTS (SELECT 1 FROM carrier_payment_transactions t WHERE t.tenant_id=NEW.tenant_id AND t.id=NEW.reversal_transaction_id AND t.obligation_id=NEW.target_id AND t.kind='reversal' AND t.related_transaction_id=OLD.ledger_transaction_id) THEN
          RAISE EXCEPTION 'reconciliation reversal must reference the original carrier payment' USING ERRCODE='P0001';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER "financial_reconciliation_matches_guard" BEFORE INSERT OR UPDATE OR DELETE ON "financial_reconciliation_matches" FOR EACH ROW EXECUTE FUNCTION "nexora_finance_reconciliation_match_guard"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_finance_reconciliation_event_guard"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'financial reconciliation events are append-only' USING ERRCODE='P0001';
END $$;--> statement-breakpoint
CREATE TRIGGER "financial_reconciliation_events_immutable" BEFORE UPDATE OR DELETE ON "financial_reconciliation_events" FOR EACH ROW EXECUTE FUNCTION "nexora_finance_reconciliation_event_guard"();--> statement-breakpoint

REVOKE ALL ON FUNCTION "nexora_finance_reconciliation_import_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_finance_reconciliation_entry_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_finance_reconciliation_match_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_finance_reconciliation_event_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "financial_reconciliation_imports" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "financial_reconciliation_entries" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "financial_reconciliation_matches" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "financial_reconciliation_events" FROM PUBLIC;--> statement-breakpoint
GRANT SELECT,INSERT ON TABLE "financial_reconciliation_imports" TO nexora_app;--> statement-breakpoint
GRANT SELECT,INSERT ON TABLE "financial_reconciliation_entries" TO nexora_app;--> statement-breakpoint
GRANT UPDATE("status","suggested_target_type","suggested_target_id","suggested_score","suggestion_reason","updated_at") ON TABLE "financial_reconciliation_entries" TO nexora_app;--> statement-breakpoint
GRANT SELECT,INSERT ON TABLE "financial_reconciliation_matches" TO nexora_app;--> statement-breakpoint
GRANT UPDATE("status","reversal_transaction_id","reversed_by_user_id","reversed_at","reverse_reason") ON TABLE "financial_reconciliation_matches" TO nexora_app;--> statement-breakpoint
GRANT SELECT ON TABLE "financial_reconciliation_events" TO nexora_app;--> statement-breakpoint
GRANT INSERT ON TABLE "financial_reconciliation_events" TO nexora_app;