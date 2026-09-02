CREATE TABLE "carrier_payment_obligations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "transport_request_id" uuid NOT NULL,
  "transport_contract_id" uuid NOT NULL,
  "trip_id" uuid,
  "carrier_party_id" uuid NOT NULL,
  "currency_code" varchar(3) NOT NULL,
  "contracted_amount" numeric(14,2) NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "status" varchar(24) DEFAULT 'open' NOT NULL,
  "notes" varchar(1000),
  "cancel_reason" varchar(1000),
  "cancelled_at" timestamp with time zone,
  "cancelled_by_user_id" uuid,
  "created_by_user_id" uuid NOT NULL,
  "updated_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "carrier_payment_obligations_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "carrier_payment_obligations_contract_unique" UNIQUE("tenant_id","transport_contract_id"),
  CONSTRAINT "carrier_payment_obligations_currency_check" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "carrier_payment_obligations_amount_check" CHECK ("contracted_amount" > 0),
  CONSTRAINT "carrier_payment_obligations_status_check" CHECK ("status" IN ('open','partially_paid','paid','cancelled')),
  CONSTRAINT "carrier_payment_obligations_cancel_check" CHECK (
    ("status" <> 'cancelled' AND "cancel_reason" IS NULL AND "cancelled_at" IS NULL AND "cancelled_by_user_id" IS NULL)
    OR
    ("status" = 'cancelled' AND "cancel_reason" IS NOT NULL AND length(trim("cancel_reason")) > 0 AND "cancelled_at" IS NOT NULL AND "cancelled_by_user_id" IS NOT NULL)
  )
);--> statement-breakpoint
ALTER TABLE "carrier_payment_obligations" ADD CONSTRAINT "carrier_payment_obligations_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_payment_obligations" ADD CONSTRAINT "carrier_payment_obligations_contract_fk" FOREIGN KEY ("tenant_id","transport_request_id","transport_contract_id") REFERENCES "public"."transport_contracts"("tenant_id","transport_request_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_payment_obligations" ADD CONSTRAINT "carrier_payment_obligations_trip_fk" FOREIGN KEY ("tenant_id","trip_id") REFERENCES "public"."trips"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_payment_obligations" ADD CONSTRAINT "carrier_payment_obligations_carrier_fk" FOREIGN KEY ("tenant_id","carrier_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_payment_obligations" ADD CONSTRAINT "carrier_payment_obligations_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_payment_obligations" ADD CONSTRAINT "carrier_payment_obligations_updated_by_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_payment_obligations" ADD CONSTRAINT "carrier_payment_obligations_cancelled_by_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "carrier_payment_obligations_tenant_status_due_idx" ON "carrier_payment_obligations" USING btree ("tenant_id","status","due_at");--> statement-breakpoint
CREATE INDEX "carrier_payment_obligations_tenant_carrier_due_idx" ON "carrier_payment_obligations" USING btree ("tenant_id","carrier_party_id","due_at");--> statement-breakpoint

CREATE TABLE "carrier_payment_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "obligation_id" uuid NOT NULL,
  "kind" varchar(24) NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "related_transaction_id" uuid,
  "proof_document_id" uuid,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "notes" varchar(1000),
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "carrier_payment_transactions_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "carrier_payment_transactions_kind_check" CHECK ("kind" IN ('advance','payment','reversal')),
  CONSTRAINT "carrier_payment_transactions_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "carrier_payment_transactions_reversal_check" CHECK (
    ("kind" = 'reversal' AND "related_transaction_id" IS NOT NULL)
    OR
    ("kind" <> 'reversal' AND "related_transaction_id" IS NULL)
  )
);--> statement-breakpoint
ALTER TABLE "carrier_payment_transactions" ADD CONSTRAINT "carrier_payment_transactions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_payment_transactions" ADD CONSTRAINT "carrier_payment_transactions_obligation_fk" FOREIGN KEY ("tenant_id","obligation_id") REFERENCES "public"."carrier_payment_obligations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_payment_transactions" ADD CONSTRAINT "carrier_payment_transactions_related_fk" FOREIGN KEY ("tenant_id","related_transaction_id") REFERENCES "public"."carrier_payment_transactions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_payment_transactions" ADD CONSTRAINT "carrier_payment_transactions_document_fk" FOREIGN KEY ("tenant_id","proof_document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_payment_transactions" ADD CONSTRAINT "carrier_payment_transactions_created_by_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "carrier_payment_transactions_single_reversal_idx" ON "carrier_payment_transactions" USING btree ("tenant_id","related_transaction_id") WHERE "kind" = 'reversal';--> statement-breakpoint
CREATE INDEX "carrier_payment_transactions_tenant_obligation_time_idx" ON "carrier_payment_transactions" USING btree ("tenant_id","obligation_id","occurred_at");--> statement-breakpoint
CREATE INDEX "carrier_payment_transactions_tenant_document_idx" ON "carrier_payment_transactions" USING btree ("tenant_id","proof_document_id") WHERE "proof_document_id" IS NOT NULL;--> statement-breakpoint

CREATE TABLE "carrier_payment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "obligation_id" uuid NOT NULL,
  "event_type" varchar(40) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "carrier_payment_events_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "carrier_payment_events_type_check" CHECK ("event_type" IN ('created','due_at_changed','notes_changed','cancelled','status_changed','transaction_recorded'))
);--> statement-breakpoint
ALTER TABLE "carrier_payment_events" ADD CONSTRAINT "carrier_payment_events_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_payment_events" ADD CONSTRAINT "carrier_payment_events_obligation_fk" FOREIGN KEY ("tenant_id","obligation_id") REFERENCES "public"."carrier_payment_obligations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_payment_events" ADD CONSTRAINT "carrier_payment_events_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "carrier_payment_events_tenant_obligation_time_idx" ON "carrier_payment_events" USING btree ("tenant_id","obligation_id","created_at");--> statement-breakpoint

ALTER TABLE "carrier_payment_obligations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "carrier_payment_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "carrier_payment_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "carrier_payment_obligations_tenant_isolation" ON "carrier_payment_obligations" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "carrier_payment_transactions_tenant_isolation" ON "carrier_payment_transactions" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "carrier_payment_events_tenant_isolation" ON "carrier_payment_events" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_carrier_payment_obligation_guard"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract record;
BEGIN
  SELECT c.transport_request_id,c.carrier_party_id,c.currency_code,
         (c.freight_amount+c.toll_amount+c.additional_amount)::numeric(14,2) AS contracted_amount,
         c.status::text AS contract_status
    INTO v_contract
    FROM transport_contracts c
   WHERE c.tenant_id=NEW.tenant_id
     AND c.id=NEW.transport_contract_id;

  IF NOT FOUND OR v_contract.contract_status NOT IN ('confirmed','fulfilled') THEN
    RAISE EXCEPTION 'carrier payment obligation requires confirmed or fulfilled transport contract' USING ERRCODE='P0001';
  END IF;

  IF NEW.transport_request_id <> v_contract.transport_request_id THEN
    RAISE EXCEPTION 'carrier payment obligation request must match transport contract' USING ERRCODE='P0001';
  END IF;

  IF TG_OP='INSERT' THEN
    NEW.carrier_party_id := v_contract.carrier_party_id;
    NEW.currency_code := v_contract.currency_code;
    NEW.contracted_amount := v_contract.contracted_amount;
    NEW.status := 'open';
    NEW.cancel_reason := NULL;
    NEW.cancelled_at := NULL;
    NEW.cancelled_by_user_id := NULL;
  ELSE
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.transport_request_id IS DISTINCT FROM OLD.transport_request_id
       OR NEW.transport_contract_id IS DISTINCT FROM OLD.transport_contract_id
       OR NEW.carrier_party_id IS DISTINCT FROM OLD.carrier_party_id
       OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
       OR NEW.contracted_amount IS DISTINCT FROM OLD.contracted_amount
       OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'carrier payment obligation identity and contracted snapshot are immutable' USING ERRCODE='P0001';
    END IF;

    IF OLD.status='cancelled' AND ROW(NEW.status,NEW.due_at,NEW.notes,NEW.trip_id) IS DISTINCT FROM ROW(OLD.status,OLD.due_at,OLD.notes,OLD.trip_id) THEN
      RAISE EXCEPTION 'cancelled carrier payment obligation is immutable' USING ERRCODE='P0001';
    END IF;
  END IF;

  IF NEW.trip_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM trip_transport_requests ttr
     WHERE ttr.tenant_id=NEW.tenant_id
       AND ttr.trip_id=NEW.trip_id
       AND ttr.transport_request_id=NEW.transport_request_id
       AND ttr.transport_contract_id=NEW.transport_contract_id
       AND ttr.removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'carrier payment obligation trip must contain the same active request and contract' USING ERRCODE='P0001';
  END IF;

  IF NEW.status='cancelled' THEN
    IF NEW.cancel_reason IS NULL OR length(trim(NEW.cancel_reason))=0 OR NEW.cancelled_at IS NULL OR NEW.cancelled_by_user_id IS NULL THEN
      RAISE EXCEPTION 'cancelled carrier payment obligation requires reason, actor and timestamp' USING ERRCODE='P0001';
    END IF;
  ELSE
    NEW.cancel_reason := NULL;
    NEW.cancelled_at := NULL;
    NEW.cancelled_by_user_id := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "carrier_payment_obligations_guard"
BEFORE INSERT OR UPDATE ON "carrier_payment_obligations"
FOR EACH ROW EXECUTE FUNCTION "nexora_carrier_payment_obligation_guard"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_carrier_payment_transaction_guard"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_obligation record;
  v_settled numeric(14,2);
  v_related record;
BEGIN
  SELECT contracted_amount,status
    INTO v_obligation
    FROM carrier_payment_obligations
   WHERE tenant_id=NEW.tenant_id
     AND id=NEW.obligation_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'carrier payment obligation not found' USING ERRCODE='P0001';
  END IF;

  IF v_obligation.status='cancelled' THEN
    RAISE EXCEPTION 'cannot record transaction on cancelled carrier payment obligation' USING ERRCODE='P0001';
  END IF;

  IF NEW.kind='reversal' THEN
    SELECT id,amount,kind,obligation_id
      INTO v_related
      FROM carrier_payment_transactions
     WHERE tenant_id=NEW.tenant_id
       AND id=NEW.related_transaction_id;

    IF NOT FOUND OR v_related.obligation_id <> NEW.obligation_id OR v_related.kind NOT IN ('advance','payment') THEN
      RAISE EXCEPTION 'reversal must reference an advance or payment from the same obligation' USING ERRCODE='P0001';
    END IF;

    IF NEW.amount <> v_related.amount THEN
      RAISE EXCEPTION 'reversal amount must equal original transaction amount' USING ERRCODE='P0001';
    END IF;

    IF EXISTS (
      SELECT 1 FROM carrier_payment_transactions r
       WHERE r.tenant_id=NEW.tenant_id
         AND r.related_transaction_id=NEW.related_transaction_id
         AND r.kind='reversal'
    ) THEN
      RAISE EXCEPTION 'transaction has already been reversed' USING ERRCODE='P0001';
    END IF;
  ELSE
    SELECT coalesce(sum(CASE WHEN kind IN ('advance','payment') THEN amount ELSE -amount END),0)::numeric(14,2)
      INTO v_settled
      FROM carrier_payment_transactions
     WHERE tenant_id=NEW.tenant_id
       AND obligation_id=NEW.obligation_id;

    IF v_settled + NEW.amount > v_obligation.contracted_amount THEN
      RAISE EXCEPTION 'carrier payment transaction exceeds obligation balance' USING ERRCODE='P0001';
    END IF;
  END IF;

  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "carrier_payment_transactions_guard"
BEFORE INSERT ON "carrier_payment_transactions"
FOR EACH ROW EXECUTE FUNCTION "nexora_carrier_payment_transaction_guard"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_carrier_payment_events_guard"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'carrier payment history is append-only' USING ERRCODE='P0001';
END
$$;--> statement-breakpoint
CREATE TRIGGER "carrier_payment_transactions_immutable"
BEFORE UPDATE OR DELETE ON "carrier_payment_transactions"
FOR EACH ROW EXECUTE FUNCTION "nexora_carrier_payment_events_guard"();--> statement-breakpoint
CREATE TRIGGER "carrier_payment_events_immutable"
BEFORE UPDATE OR DELETE ON "carrier_payment_events"
FOR EACH ROW EXECUTE FUNCTION "nexora_carrier_payment_events_guard"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_carrier_payment_obligation_events"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := coalesce(NEW.updated_by_user_id,NEW.created_by_user_id);

  IF TG_OP='INSERT' THEN
    INSERT INTO carrier_payment_events (tenant_id,obligation_id,event_type,payload,actor_user_id)
    VALUES (NEW.tenant_id,NEW.id,'created',jsonb_build_object('contractedAmount',NEW.contracted_amount,'dueAt',NEW.due_at,'tripId',NEW.trip_id),NEW.created_by_user_id);
    RETURN NEW;
  END IF;

  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    INSERT INTO carrier_payment_events (tenant_id,obligation_id,event_type,payload,actor_user_id)
    VALUES (NEW.tenant_id,NEW.id,'due_at_changed',jsonb_build_object('from',OLD.due_at,'to',NEW.due_at),v_actor);
  END IF;

  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO carrier_payment_events (tenant_id,obligation_id,event_type,payload,actor_user_id)
    VALUES (NEW.tenant_id,NEW.id,'notes_changed',jsonb_build_object('from',OLD.notes,'to',NEW.notes),v_actor);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO carrier_payment_events (tenant_id,obligation_id,event_type,payload,actor_user_id)
    VALUES (NEW.tenant_id,NEW.id,CASE WHEN NEW.status='cancelled' THEN 'cancelled' ELSE 'status_changed' END,
            jsonb_build_object('from',OLD.status,'to',NEW.status,'reason',NEW.cancel_reason),v_actor);
  END IF;

  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "carrier_payment_obligations_events"
AFTER INSERT OR UPDATE ON "carrier_payment_obligations"
FOR EACH ROW EXECUTE FUNCTION "nexora_carrier_payment_obligation_events"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_carrier_payment_transaction_events"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settled numeric(14,2);
  v_amount numeric(14,2);
  v_status varchar(24);
BEGIN
  SELECT contracted_amount INTO v_amount
    FROM carrier_payment_obligations
   WHERE tenant_id=NEW.tenant_id AND id=NEW.obligation_id;

  SELECT coalesce(sum(CASE WHEN kind IN ('advance','payment') THEN amount ELSE -amount END),0)::numeric(14,2)
    INTO v_settled
    FROM carrier_payment_transactions
   WHERE tenant_id=NEW.tenant_id
     AND obligation_id=NEW.obligation_id;

  v_status := CASE
    WHEN v_settled <= 0 THEN 'open'
    WHEN v_settled >= v_amount THEN 'paid'
    ELSE 'partially_paid'
  END;

  UPDATE carrier_payment_obligations
     SET status=v_status,
         updated_by_user_id=NEW.created_by_user_id,
         updated_at=now()
   WHERE tenant_id=NEW.tenant_id
     AND id=NEW.obligation_id
     AND status <> 'cancelled';

  INSERT INTO carrier_payment_events (tenant_id,obligation_id,event_type,payload,actor_user_id)
  VALUES (
    NEW.tenant_id,
    NEW.obligation_id,
    'transaction_recorded',
    jsonb_build_object('transactionId',NEW.id,'kind',NEW.kind,'amount',NEW.amount,'proofDocumentId',NEW.proof_document_id,'relatedTransactionId',NEW.related_transaction_id),
    NEW.created_by_user_id
  );

  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "carrier_payment_transactions_events"
AFTER INSERT ON "carrier_payment_transactions"
FOR EACH ROW EXECUTE FUNCTION "nexora_carrier_payment_transaction_events"();--> statement-breakpoint

REVOKE ALL ON TABLE "carrier_payment_obligations" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "carrier_payment_transactions" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "carrier_payment_events" FROM PUBLIC;--> statement-breakpoint
GRANT SELECT,INSERT ON TABLE "carrier_payment_obligations" TO "nexora_app";--> statement-breakpoint
GRANT UPDATE ("due_at","trip_id","notes","status","cancel_reason","cancelled_at","cancelled_by_user_id","updated_by_user_id","updated_at") ON TABLE "carrier_payment_obligations" TO "nexora_app";--> statement-breakpoint
GRANT SELECT,INSERT ON TABLE "carrier_payment_transactions" TO "nexora_app";--> statement-breakpoint
GRANT SELECT ON TABLE "carrier_payment_events" TO "nexora_app";--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_carrier_payment_obligation_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_carrier_payment_transaction_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_carrier_payment_events_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_carrier_payment_obligation_events"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_carrier_payment_transaction_events"() FROM PUBLIC;