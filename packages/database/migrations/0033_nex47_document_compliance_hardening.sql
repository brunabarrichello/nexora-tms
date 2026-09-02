ALTER TABLE "document_compliance_overrides"
  ADD CONSTRAINT "document_compliance_overrides_max_duration_check"
  CHECK ("valid_until" <= "created_at" + interval '30 days');--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_contract_document_compliance_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM nexora_assert_document_compliance('driver',NEW.driver_id,'contracting');
    PERFORM nexora_assert_document_compliance('asset',NEW.vehicle_id,'contracting');
    PERFORM nexora_assert_document_compliance('party',NEW.carrier_party_id,'contracting');
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.driver_id IS DISTINCT FROM NEW.driver_id
     OR OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id
     OR OLD.carrier_party_id IS DISTINCT FROM NEW.carrier_party_id THEN
    PERFORM nexora_assert_document_compliance('driver',NEW.driver_id,'contracting');
    PERFORM nexora_assert_document_compliance('asset',NEW.vehicle_id,'contracting');
    PERFORM nexora_assert_document_compliance('party',NEW.carrier_party_id,'contracting');
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_active_trip_capacity_document_compliance_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_trip_status text;
BEGIN
  SELECT status::text INTO v_trip_status
    FROM trips
   WHERE tenant_id=NEW.tenant_id
     AND id=NEW.trip_id;

  IF v_trip_status IN ('ready','in_transit') THEN
    IF TG_TABLE_NAME='trip_drivers' THEN
      PERFORM nexora_assert_document_compliance('driver',NEW.driver_id,'trip');
    ELSE
      PERFORM nexora_assert_document_compliance('asset',NEW.asset_id,'trip');
    END IF;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_document_compliance_override_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_scope text;
  v_exists boolean;
BEGIN
  SELECT subject_scope INTO v_scope
    FROM document_types
   WHERE tenant_id=NEW.tenant_id
     AND id=NEW.document_type_id
     AND is_active=true;

  IF v_scope IS NULL THEN
    RAISE EXCEPTION 'active document type does not exist in current tenant';
  END IF;
  IF v_scope <> NEW.subject_scope THEN
    RAISE EXCEPTION 'override subject scope does not match document type policy scope';
  END IF;

  IF NEW.subject_scope='party' THEN
    SELECT EXISTS(
      SELECT 1 FROM business_parties
       WHERE tenant_id=NEW.tenant_id AND id=NEW.subject_id
    ) INTO v_exists;
  ELSIF NEW.subject_scope='driver' THEN
    SELECT EXISTS(
      SELECT 1 FROM drivers
       WHERE tenant_id=NEW.tenant_id AND id=NEW.subject_id
    ) INTO v_exists;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM capacity_assets
       WHERE tenant_id=NEW.tenant_id AND id=NEW.subject_id
    ) INTO v_exists;
  END IF;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'override subject does not exist in current tenant';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM document_compliance_policies p
     WHERE p.tenant_id=NEW.tenant_id
       AND p.document_type_id=NEW.document_type_id
       AND p.is_active=true
       AND ((NEW.context='contracting' AND p.required_for_contracting)
         OR (NEW.context='trip' AND p.required_for_trip))
  ) THEN
    RAISE EXCEPTION 'active compliance policy is not enabled for override context';
  END IF;

  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "document_compliance_overrides_guard"
BEFORE INSERT ON "document_compliance_overrides"
FOR EACH ROW EXECUTE FUNCTION "nexora_document_compliance_override_guard"();--> statement-breakpoint

REVOKE UPDATE ON TABLE "document_compliance_policies" FROM nexora_app;--> statement-breakpoint
GRANT UPDATE (
  required_for_contracting,
  required_for_trip,
  warning_days,
  block_when_expiring_soon,
  block_when_pending,
  block_when_rejected,
  block_when_expired,
  is_active,
  updated_by_user_id,
  updated_at
) ON TABLE "document_compliance_policies" TO nexora_app;--> statement-breakpoint

REVOKE ALL ON FUNCTION "nexora_document_compliance_policy_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_document_compliance_override_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_contract_document_compliance_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_trip_document_compliance_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_active_trip_capacity_document_compliance_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_evaluate_document_compliance"(text,uuid,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_assert_document_compliance"(text,uuid,text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_evaluate_document_compliance"(text,uuid,text) TO nexora_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_assert_document_compliance"(text,uuid,text) TO nexora_app;