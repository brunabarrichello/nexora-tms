CREATE TABLE "customer_receivables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "transport_request_id" uuid NOT NULL,
  "customer_party_id" uuid NOT NULL,
  "currency_code" varchar(3) NOT NULL,
  "invoiced_amount" numeric(14,2) NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "status" varchar(24) DEFAULT 'open' NOT NULL,
  "fiscal_document_id" uuid,
  "fiscal_reference" varchar(160),
  "notes" varchar(1000),
  "cancel_reason" varchar(1000),
  "cancelled_at" timestamp with time zone,
  "cancelled_by_user_id" uuid,
  "created_by_user_id" uuid NOT NULL,
  "updated_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_receivables_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "customer_receivables_request_unique" UNIQUE("tenant_id","transport_request_id"),
  CONSTRAINT "customer_receivables_currency_check" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "customer_receivables_amount_check" CHECK ("invoiced_amount" > 0),
  CONSTRAINT "customer_receivables_status_check" CHECK ("status" IN ('open','partially_received','paid','cancelled')),
  CONSTRAINT "customer_receivables_fiscal_reference_check" CHECK ("fiscal_reference" IS NULL OR length(trim("fiscal_reference")) > 0),
  CONSTRAINT "customer_receivables_cancel_check" CHECK (
    ("status" <> 'cancelled' AND "cancel_reason" IS NULL AND "cancelled_at" IS NULL AND "cancelled_by_user_id" IS NULL)
    OR
    ("status" = 'cancelled' AND "cancel_reason" IS NOT NULL AND length(trim("cancel_reason")) > 0 AND "cancelled_at" IS NOT NULL AND "cancelled_by_user_id" IS NOT NULL)
  )
);--> statement-breakpoint
ALTER TABLE "customer_receivables" ADD CONSTRAINT "customer_receivables_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_receivables" ADD CONSTRAINT "customer_receivables_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_receivables" ADD CONSTRAINT "customer_receivables_customer_fk" FOREIGN KEY ("tenant_id","customer_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_receivables" ADD CONSTRAINT "customer_receivables_fiscal_document_fk" FOREIGN KEY ("tenant_id","fiscal_document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_receivables" ADD CONSTRAINT "customer_receivables_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_receivables" ADD CONSTRAINT "customer_receivables_updated_by_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_receivables" ADD CONSTRAINT "customer_receivables_cancelled_by_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_receivables_tenant_status_due_idx" ON "customer_receivables" USING btree ("tenant_id","status","due_at");--> statement-breakpoint
CREATE INDEX "customer_receivables_tenant_customer_due_idx" ON "customer_receivables" USING btree ("tenant_id","customer_party_id","due_at");--> statement-breakpoint

CREATE TABLE "customer_receivable_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "receivable_id" uuid NOT NULL,
  "kind" varchar(24) NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "related_transaction_id" uuid,
  "proof_document_id" uuid,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "notes" varchar(1000),
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_receivable_transactions_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "customer_receivable_transactions_kind_check" CHECK ("kind" IN ('receipt','reversal')),
  CONSTRAINT "customer_receivable_transactions_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "customer_receivable_transactions_reversal_check" CHECK (
    ("kind" = 'reversal' AND "related_transaction_id" IS NOT NULL)
    OR
    ("kind" = 'receipt' AND "related_transaction_id" IS NULL)
  )
);--> statement-breakpoint
ALTER TABLE "customer_receivable_transactions" ADD CONSTRAINT "customer_receivable_transactions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_receivable_transactions" ADD CONSTRAINT "customer_receivable_transactions_receivable_fk" FOREIGN KEY ("tenant_id","receivable_id") REFERENCES "public"."customer_receivables"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_receivable_transactions" ADD CONSTRAINT "customer_receivable_transactions_related_fk" FOREIGN KEY ("tenant_id","related_transaction_id") REFERENCES "public"."customer_receivable_transactions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_receivable_transactions" ADD CONSTRAINT "customer_receivable_transactions_document_fk" FOREIGN KEY ("tenant_id","proof_document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_receivable_transactions" ADD CONSTRAINT "customer_receivable_transactions_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_receivable_transactions_single_reversal_idx" ON "customer_receivable_transactions" USING btree ("tenant_id","related_transaction_id") WHERE "kind" = 'reversal';--> statement-breakpoint
CREATE INDEX "customer_receivable_transactions_tenant_receivable_time_idx" ON "customer_receivable_transactions" USING btree ("tenant_id","receivable_id","occurred_at");--> statement-breakpoint

CREATE TABLE "customer_receivable_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "receivable_id" uuid NOT NULL,
  "event_type" varchar(40) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_receivable_events_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "customer_receivable_events_type_check" CHECK ("event_type" IN ('created','due_at_changed','fiscal_changed','notes_changed','cancelled','status_changed','transaction_recorded'))
);--> statement-breakpoint
ALTER TABLE "customer_receivable_events" ADD CONSTRAINT "customer_receivable_events_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_receivable_events" ADD CONSTRAINT "customer_receivable_events_receivable_fk" FOREIGN KEY ("tenant_id","receivable_id") REFERENCES "public"."customer_receivables"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_receivable_events" ADD CONSTRAINT "customer_receivable_events_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_receivable_events_tenant_receivable_time_idx" ON "customer_receivable_events" USING btree ("tenant_id","receivable_id","created_at");--> statement-breakpoint

ALTER TABLE "customer_receivables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_receivable_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_receivable_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "customer_receivables_tenant_isolation" ON "customer_receivables" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "customer_receivable_transactions_tenant_isolation" ON "customer_receivable_transactions" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "customer_receivable_events_tenant_isolation" ON "customer_receivable_events" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_customer_receivable_guard"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source record;
  v_received numeric(14,2) := 0;
BEGIN
  SELECT r.customer_party_id,terms.currency_code
    INTO v_source
    FROM transport_requests r
    JOIN transport_request_commercial_terms terms
      ON terms.tenant_id=r.tenant_id AND terms.transport_request_id=r.id
   WHERE r.tenant_id=NEW.tenant_id
     AND r.id=NEW.transport_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer receivable requires transport request with commercial terms' USING ERRCODE='P0001';
  END IF;

  IF TG_OP='INSERT' THEN
    NEW.customer_party_id := v_source.customer_party_id;
    NEW.currency_code := v_source.currency_code;
    NEW.status := 'open';
    NEW.cancel_reason := NULL;
    NEW.cancelled_at := NULL;
    NEW.cancelled_by_user_id := NULL;
  ELSE
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.transport_request_id IS DISTINCT FROM OLD.transport_request_id
       OR NEW.customer_party_id IS DISTINCT FROM OLD.customer_party_id
       OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
       OR NEW.invoiced_amount IS DISTINCT FROM OLD.invoiced_amount
       OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'customer receivable identity and invoice snapshot are immutable' USING ERRCODE='P0001';
    END IF;

    IF OLD.status='cancelled' AND ROW(NEW.status,NEW.due_at,NEW.notes,NEW.fiscal_document_id,NEW.fiscal_reference) IS DISTINCT FROM ROW(OLD.status,OLD.due_at,OLD.notes,OLD.fiscal_document_id,OLD.fiscal_reference) THEN
      RAISE EXCEPTION 'cancelled customer receivable is immutable' USING ERRCODE='P0001';
    END IF;

    SELECT coalesce(sum(CASE WHEN kind='receipt' THEN amount ELSE -amount END),0)::numeric(14,2)
      INTO v_received
      FROM customer_receivable_transactions
     WHERE tenant_id=NEW.tenant_id
       AND receivable_id=NEW.id;
  END IF;

  IF NEW.fiscal_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM documents d
      JOIN document_types dt ON dt.tenant_id=d.tenant_id AND dt.id=d.document_type_id
     WHERE d.tenant_id=NEW.tenant_id
       AND d.id=NEW.fiscal_document_id
       AND d.deleted_at IS NULL
       AND dt.subject_scope='financial'
  ) THEN
    RAISE EXCEPTION 'fiscal document must be an active financial document in current tenant' USING ERRCODE='P0001';
  END IF;

  IF TG_OP='UPDATE' AND NEW.status='cancelled' THEN
    IF v_received > 0 THEN
      RAISE EXCEPTION 'received customer receivable must reverse receipts before cancellation' USING ERRCODE='P0001';
    END IF;
    IF NEW.cancel_reason IS NULL OR length(trim(NEW.cancel_reason))=0 OR NEW.cancelled_at IS NULL OR NEW.cancelled_by_user_id IS NULL THEN
      RAISE EXCEPTION 'cancelled customer receivable requires reason, actor and timestamp' USING ERRCODE='P0001';
    END IF;
  ELSIF TG_OP='UPDATE' THEN
    NEW.status := CASE
      WHEN v_received <= 0 THEN 'open'
      WHEN v_received >= NEW.invoiced_amount THEN 'paid'
      ELSE 'partially_received'
    END;
    NEW.cancel_reason := NULL;
    NEW.cancelled_at := NULL;
    NEW.cancelled_by_user_id := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "customer_receivables_guard"
BEFORE INSERT OR UPDATE ON "customer_receivables"
FOR EACH ROW EXECUTE FUNCTION "nexora_customer_receivable_guard"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_customer_receivable_transaction_guard"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receivable record;
  v_received numeric(14,2);
  v_related record;
BEGIN
  SELECT invoiced_amount,status
    INTO v_receivable
    FROM customer_receivables
   WHERE tenant_id=NEW.tenant_id
     AND id=NEW.receivable_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer receivable not found' USING ERRCODE='P0001';
  END IF;

  IF v_receivable.status='cancelled' THEN
    RAISE EXCEPTION 'cannot record transaction on cancelled customer receivable' USING ERRCODE='P0001';
  END IF;

  IF NEW.proof_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM documents d
      JOIN document_types dt ON dt.tenant_id=d.tenant_id AND dt.id=d.document_type_id
     WHERE d.tenant_id=NEW.tenant_id
       AND d.id=NEW.proof_document_id
       AND d.deleted_at IS NULL
       AND dt.subject_scope='financial'
  ) THEN
    RAISE EXCEPTION 'receipt proof must be an active financial document in current tenant' USING ERRCODE='P0001';
  END IF;

  IF NEW.kind='reversal' THEN
    SELECT id,amount,kind,receivable_id,occurred_at
      INTO v_related
      FROM customer_receivable_transactions
     WHERE tenant_id=NEW.tenant_id
       AND id=NEW.related_transaction_id;

    IF NOT FOUND OR v_related.receivable_id <> NEW.receivable_id OR v_related.kind <> 'receipt' THEN
      RAISE EXCEPTION 'reversal must reference a receipt from the same receivable' USING ERRCODE='P0001';
    END IF;
    IF NEW.amount <> v_related.amount THEN
      RAISE EXCEPTION 'reversal amount must equal original receipt amount' USING ERRCODE='P0001';
    END IF;
    IF NEW.occurred_at < v_related.occurred_at THEN
      RAISE EXCEPTION 'reversal cannot occur before original receipt' USING ERRCODE='P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM customer_receivable_transactions r
       WHERE r.tenant_id=NEW.tenant_id
         AND r.related_transaction_id=NEW.related_transaction_id
         AND r.kind='reversal'
    ) THEN
      RAISE EXCEPTION 'receipt has already been reversed' USING ERRCODE='P0001';
    END IF;
  ELSE
    SELECT coalesce(sum(CASE WHEN kind='receipt' THEN amount ELSE -amount END),0)::numeric(14,2)
      INTO v_received
      FROM customer_receivable_transactions
     WHERE tenant_id=NEW.tenant_id
       AND receivable_id=NEW.receivable_id;

    IF v_received + NEW.amount > v_receivable.invoiced_amount THEN
      RAISE EXCEPTION 'customer receipt exceeds receivable balance' USING ERRCODE='P0001';
    END IF;
  END IF;

  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "customer_receivable_transactions_guard"
BEFORE INSERT ON "customer_receivable_transactions"
FOR EACH ROW EXECUTE FUNCTION "nexora_customer_receivable_transaction_guard"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_customer_receivable_append_only_guard"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'customer receivable history is append-only' USING ERRCODE='P0001';
END
$$;--> statement-breakpoint
CREATE TRIGGER "customer_receivable_transactions_immutable"
BEFORE UPDATE OR DELETE ON "customer_receivable_transactions"
FOR EACH ROW EXECUTE FUNCTION "nexora_customer_receivable_append_only_guard"();--> statement-breakpoint
CREATE TRIGGER "customer_receivable_events_immutable"
BEFORE UPDATE OR DELETE ON "customer_receivable_events"
FOR EACH ROW EXECUTE FUNCTION "nexora_customer_receivable_append_only_guard"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_customer_receivable_events"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := NEW.updated_by_user_id;
  IF TG_OP='INSERT' THEN
    INSERT INTO customer_receivable_events(tenant_id,receivable_id,event_type,payload,actor_user_id)
    VALUES (NEW.tenant_id,NEW.id,'created',jsonb_build_object('invoicedAmount',NEW.invoiced_amount,'dueAt',NEW.due_at,'customerPartyId',NEW.customer_party_id),NEW.created_by_user_id);
    RETURN NEW;
  END IF;
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    INSERT INTO customer_receivable_events(tenant_id,receivable_id,event_type,payload,actor_user_id)
    VALUES (NEW.tenant_id,NEW.id,'due_at_changed',jsonb_build_object('from',OLD.due_at,'to',NEW.due_at),v_actor);
  END IF;
  IF ROW(NEW.fiscal_document_id,NEW.fiscal_reference) IS DISTINCT FROM ROW(OLD.fiscal_document_id,OLD.fiscal_reference) THEN
    INSERT INTO customer_receivable_events(tenant_id,receivable_id,event_type,payload,actor_user_id)
    VALUES (NEW.tenant_id,NEW.id,'fiscal_changed',jsonb_build_object('fiscalDocumentId',NEW.fiscal_document_id,'fiscalReference',NEW.fiscal_reference),v_actor);
  END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO customer_receivable_events(tenant_id,receivable_id,event_type,payload,actor_user_id)
    VALUES (NEW.tenant_id,NEW.id,'notes_changed',jsonb_build_object('notes',NEW.notes),v_actor);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO customer_receivable_events(tenant_id,receivable_id,event_type,payload,actor_user_id)
    VALUES (NEW.tenant_id,NEW.id,CASE WHEN NEW.status='cancelled' THEN 'cancelled' ELSE 'status_changed' END,jsonb_build_object('from',OLD.status,'to',NEW.status,'reason',NEW.cancel_reason),v_actor);
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "customer_receivables_events"
AFTER INSERT OR UPDATE ON "customer_receivables"
FOR EACH ROW EXECUTE FUNCTION "nexora_customer_receivable_events"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_customer_receivable_transaction_events"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO customer_receivable_events(tenant_id,receivable_id,event_type,payload,actor_user_id)
  VALUES (NEW.tenant_id,NEW.receivable_id,'transaction_recorded',jsonb_build_object('transactionId',NEW.id,'kind',NEW.kind,'amount',NEW.amount,'relatedTransactionId',NEW.related_transaction_id),NEW.created_by_user_id);

  UPDATE customer_receivables
     SET updated_by_user_id=NEW.created_by_user_id
   WHERE tenant_id=NEW.tenant_id AND id=NEW.receivable_id;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "customer_receivable_transactions_events"
AFTER INSERT ON "customer_receivable_transactions"
FOR EACH ROW EXECUTE FUNCTION "nexora_customer_receivable_transaction_events"();--> statement-breakpoint

REVOKE ALL ON FUNCTION "nexora_customer_receivable_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_customer_receivable_transaction_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_customer_receivable_append_only_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_customer_receivable_events"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_customer_receivable_transaction_events"() FROM PUBLIC;--> statement-breakpoint

REVOKE ALL ON TABLE "customer_receivables" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "customer_receivable_transactions" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "customer_receivable_events" FROM PUBLIC;--> statement-breakpoint
GRANT SELECT,INSERT ON TABLE "customer_receivables" TO nexora_app;--> statement-breakpoint
GRANT UPDATE("due_at","fiscal_document_id","fiscal_reference","notes","status","cancel_reason","cancelled_at","cancelled_by_user_id","updated_by_user_id","updated_at") ON TABLE "customer_receivables" TO nexora_app;--> statement-breakpoint
GRANT SELECT,INSERT ON TABLE "customer_receivable_transactions" TO nexora_app;--> statement-breakpoint
GRANT SELECT ON TABLE "customer_receivable_events" TO nexora_app;