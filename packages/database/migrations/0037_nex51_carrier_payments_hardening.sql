CREATE OR REPLACE FUNCTION "nexora_carrier_payment_obligation_guard"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract record;
  v_settled numeric(14,2) := 0;
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

    SELECT coalesce(sum(CASE WHEN kind IN ('advance','payment') THEN amount ELSE -amount END),0)::numeric(14,2)
      INTO v_settled
      FROM carrier_payment_transactions
     WHERE tenant_id=NEW.tenant_id
       AND obligation_id=NEW.id;
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

  IF TG_OP='UPDATE' AND NEW.status='cancelled' THEN
    IF v_settled > 0 THEN
      RAISE EXCEPTION 'paid carrier payment obligation must reverse transactions before cancellation' USING ERRCODE='P0001';
    END IF;
    IF NEW.cancel_reason IS NULL OR length(trim(NEW.cancel_reason))=0 OR NEW.cancelled_at IS NULL OR NEW.cancelled_by_user_id IS NULL THEN
      RAISE EXCEPTION 'cancelled carrier payment obligation requires reason, actor and timestamp' USING ERRCODE='P0001';
    END IF;
  ELSIF TG_OP='UPDATE' THEN
    NEW.status := CASE
      WHEN v_settled <= 0 THEN 'open'
      WHEN v_settled >= NEW.contracted_amount THEN 'paid'
      ELSE 'partially_paid'
    END;
    NEW.cancel_reason := NULL;
    NEW.cancelled_at := NULL;
    NEW.cancelled_by_user_id := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_carrier_payment_obligation_guard"() FROM PUBLIC;