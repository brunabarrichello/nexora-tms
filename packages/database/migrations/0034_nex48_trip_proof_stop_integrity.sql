ALTER TABLE "trip_proofs"
  ADD CONSTRAINT "trip_proofs_operational_stop_required_check"
  CHECK ("proof_type" NOT IN ('pickup','delivery') OR "trip_stop_id" IS NOT NULL);
--> statement-breakpoint

CREATE FUNCTION "nexora_trip_proof_stop_integrity_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_stop_type text;
  v_document_stop_id uuid;
BEGIN
  IF NEW.proof_type NOT IN ('pickup','delivery') THEN
    RETURN NEW;
  END IF;

  IF NEW.trip_stop_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE='P0001',
      MESSAGE=format('%s proof requires a trip stop', NEW.proof_type);
  END IF;

  SELECT s.type::text
    INTO v_stop_type
    FROM trip_stops s
   WHERE s.tenant_id=NEW.tenant_id
     AND s.trip_id=NEW.trip_id
     AND s.id=NEW.trip_stop_id;

  IF v_stop_type IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE='P0001',
      MESSAGE='trip proof stop does not exist in the current tenant/trip';
  END IF;

  IF v_stop_type <> NEW.proof_type THEN
    RAISE EXCEPTION USING
      ERRCODE='P0001',
      MESSAGE=format('%s proof requires a %s stop', NEW.proof_type, NEW.proof_type);
  END IF;

  SELECT d.trip_stop_id
    INTO v_document_stop_id
    FROM trip_documents d
   WHERE d.tenant_id=NEW.tenant_id
     AND d.trip_id=NEW.trip_id
     AND d.id=NEW.trip_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE='P0001',
      MESSAGE='trip proof document link does not exist in the current tenant/trip';
  END IF;

  IF v_document_stop_id IS NOT NULL AND v_document_stop_id <> NEW.trip_stop_id THEN
    RAISE EXCEPTION USING
      ERRCODE='P0001',
      MESSAGE='trip proof document and proof must refer to the same stop';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint

CREATE TRIGGER "trip_proofs_stop_integrity_guard"
BEFORE INSERT OR UPDATE OF tenant_id,trip_id,trip_stop_id,trip_document_id,proof_type
ON "trip_proofs"
FOR EACH ROW
EXECUTE FUNCTION "nexora_trip_proof_stop_integrity_guard"();
--> statement-breakpoint

REVOKE ALL ON FUNCTION "nexora_trip_proof_stop_integrity_guard"() FROM PUBLIC;