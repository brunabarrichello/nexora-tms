CREATE TABLE "document_compliance_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "document_type_id" uuid NOT NULL,
  "required_for_contracting" boolean DEFAULT false NOT NULL,
  "required_for_trip" boolean DEFAULT false NOT NULL,
  "warning_days" integer DEFAULT 30 NOT NULL,
  "block_when_expiring_soon" boolean DEFAULT false NOT NULL,
  "block_when_pending" boolean DEFAULT true NOT NULL,
  "block_when_rejected" boolean DEFAULT true NOT NULL,
  "block_when_expired" boolean DEFAULT true NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "updated_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "document_compliance_policies_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "document_compliance_policies_tenant_type_unique" UNIQUE("tenant_id","document_type_id"),
  CONSTRAINT "document_compliance_policies_warning_days_check" CHECK ("warning_days" >= 0 AND "warning_days" <= 365),
  CONSTRAINT "document_compliance_policies_context_check" CHECK ("required_for_contracting" OR "required_for_trip")
);--> statement-breakpoint
ALTER TABLE "document_compliance_policies" ADD CONSTRAINT "document_compliance_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_compliance_policies" ADD CONSTRAINT "document_compliance_policies_document_type_fk" FOREIGN KEY ("tenant_id","document_type_id") REFERENCES "public"."document_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_compliance_policies" ADD CONSTRAINT "document_compliance_policies_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_compliance_policies" ADD CONSTRAINT "document_compliance_policies_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_compliance_policies_tenant_active_idx" ON "document_compliance_policies" USING btree ("tenant_id","is_active","required_for_contracting","required_for_trip");--> statement-breakpoint
ALTER TABLE "document_compliance_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "document_compliance_policies_tenant_isolation" ON "document_compliance_policies" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

CREATE TABLE "document_compliance_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "context" varchar(24) NOT NULL,
  "subject_scope" varchar(24) NOT NULL,
  "subject_id" uuid NOT NULL,
  "document_type_id" uuid NOT NULL,
  "reason" varchar(1000) NOT NULL,
  "valid_until" timestamp with time zone NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "document_compliance_overrides_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "document_compliance_overrides_context_check" CHECK ("context" in ('contracting','trip')),
  CONSTRAINT "document_compliance_overrides_scope_check" CHECK ("subject_scope" in ('party','driver','asset')),
  CONSTRAINT "document_compliance_overrides_reason_check" CHECK (length(trim("reason")) >= 10),
  CONSTRAINT "document_compliance_overrides_validity_check" CHECK ("valid_until" > "created_at")
);--> statement-breakpoint
ALTER TABLE "document_compliance_overrides" ADD CONSTRAINT "document_compliance_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_compliance_overrides" ADD CONSTRAINT "document_compliance_overrides_document_type_fk" FOREIGN KEY ("tenant_id","document_type_id") REFERENCES "public"."document_types"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_compliance_overrides" ADD CONSTRAINT "document_compliance_overrides_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_compliance_overrides_lookup_idx" ON "document_compliance_overrides" USING btree ("tenant_id","context","subject_scope","subject_id","document_type_id","valid_until");--> statement-breakpoint
ALTER TABLE "document_compliance_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "document_compliance_overrides_tenant_isolation" ON "document_compliance_overrides" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

CREATE FUNCTION "nexora_document_compliance_policy_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_scope text;
BEGIN
  SELECT subject_scope INTO v_scope
    FROM document_types
   WHERE tenant_id = NEW.tenant_id
     AND id = NEW.document_type_id;

  IF v_scope IS NULL THEN
    RAISE EXCEPTION 'document type does not exist in current tenant';
  END IF;
  IF v_scope NOT IN ('party','driver','asset') THEN
    RAISE EXCEPTION 'blocking compliance policy supports party, driver or asset document types only';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "document_compliance_policies_scope_guard"
BEFORE INSERT OR UPDATE OF tenant_id, document_type_id ON "document_compliance_policies"
FOR EACH ROW EXECUTE FUNCTION "nexora_document_compliance_policy_guard"();--> statement-breakpoint

CREATE FUNCTION "nexora_evaluate_document_compliance"(
  p_subject_scope text,
  p_subject_id uuid,
  p_context text
)
RETURNS TABLE (
  document_type_id uuid,
  document_type_code text,
  document_type_name text,
  state text,
  blocking boolean,
  expires_on date,
  warning_days integer,
  override_id uuid,
  reason text
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_subject_scope NOT IN ('party','driver','asset') THEN
    RAISE EXCEPTION 'unsupported compliance subject scope: %', p_subject_scope;
  END IF;
  IF p_context NOT IN ('contracting','trip') THEN
    RAISE EXCEPTION 'unsupported compliance context: %', p_context;
  END IF;

  RETURN QUERY
  WITH active_policies AS (
    SELECT p.*, dt.code, dt.name, dt.subject_scope
      FROM document_compliance_policies p
      JOIN document_types dt
        ON dt.tenant_id=p.tenant_id AND dt.id=p.document_type_id
     WHERE p.is_active=true
       AND dt.is_active=true
       AND dt.subject_scope=p_subject_scope
       AND ((p_context='contracting' AND p.required_for_contracting)
         OR (p_context='trip' AND p.required_for_trip))
  ), policy_documents AS (
    SELECT p.*,
           candidate.status AS candidate_status,
           candidate.validation_status AS candidate_validation_status,
           candidate.expires_on AS candidate_expires_on,
           candidate.created_at AS candidate_created_at
      FROM active_policies p
      LEFT JOIN LATERAL (
        SELECT c.status,c.validation_status,c.expires_on,c.created_at
          FROM (
            SELECT d.status::text AS status,
                   CASE WHEN d.status='valid' THEN 'validated' WHEN d.status='rejected' THEN 'rejected' ELSE 'pending' END::text AS validation_status,
                   d.expires_on,
                   d.created_at
              FROM business_party_documents l
              JOIN documents d ON d.tenant_id=l.tenant_id AND d.id=l.document_id
             WHERE p_subject_scope='party'
               AND l.business_party_id=p_subject_id
               AND d.document_type_id=p.document_type_id
               AND d.deleted_at IS NULL
            UNION ALL
            SELECT CASE WHEN d.id IS NOT NULL THEN d.status::text ELSE r.status::text END,
                   CASE WHEN d.id IS NOT NULL THEN
                          CASE WHEN d.status='valid' THEN 'validated' WHEN d.status='rejected' THEN 'rejected' ELSE 'pending' END::text
                        ELSE r.validation_status::text END,
                   CASE WHEN d.id IS NOT NULL THEN d.expires_on ELSE r.expires_on END,
                   CASE WHEN d.id IS NOT NULL THEN d.created_at ELSE r.created_at END
              FROM driver_documents r
              LEFT JOIN documents d
                ON d.tenant_id=r.tenant_id AND d.id=r.document_id AND d.deleted_at IS NULL
             WHERE p_subject_scope='driver'
               AND r.driver_id=p_subject_id
               AND r.document_type_id=p.document_type_id
               AND ((r.document_id IS NULL AND r.status <> 'inactive') OR d.id IS NOT NULL)
            UNION ALL
            SELECT CASE WHEN d.id IS NOT NULL THEN d.status::text ELSE r.status::text END,
                   CASE WHEN d.id IS NOT NULL THEN
                          CASE WHEN d.status='valid' THEN 'validated' WHEN d.status='rejected' THEN 'rejected' ELSE 'pending' END::text
                        ELSE r.validation_status::text END,
                   CASE WHEN d.id IS NOT NULL THEN d.expires_on ELSE r.expires_on END,
                   CASE WHEN d.id IS NOT NULL THEN d.created_at ELSE r.created_at END
              FROM capacity_asset_documents r
              LEFT JOIN documents d
                ON d.tenant_id=r.tenant_id AND d.id=r.document_id AND d.deleted_at IS NULL
             WHERE p_subject_scope='asset'
               AND r.asset_id=p_subject_id
               AND r.document_type_id=p.document_type_id
               AND ((r.document_id IS NULL AND r.status <> 'inactive') OR d.id IS NOT NULL)
          ) c
         ORDER BY c.created_at DESC NULLS LAST
         LIMIT 1
      ) candidate ON true
  ), evaluated AS (
    SELECT p.*,
      CASE
        WHEN p.candidate_created_at IS NULL THEN 'missing'
        WHEN p.candidate_expires_on IS NOT NULL AND p.candidate_expires_on < current_date THEN 'expired'
        WHEN p.candidate_status IN ('rejected','blocked') OR p.candidate_validation_status='rejected' THEN 'rejected'
        WHEN p.candidate_status IN ('draft','pending') OR p.candidate_validation_status='pending' THEN 'pending'
        WHEN p.candidate_expires_on IS NOT NULL
             AND p.candidate_expires_on <= current_date + p.warning_days THEN 'expiring_soon'
        ELSE 'valid'
      END AS compliance_state
    FROM policy_documents p
  )
  SELECT e.document_type_id,
         e.code::text,
         e.name::text,
         e.compliance_state,
         CASE WHEN o.id IS NOT NULL THEN false
              WHEN e.compliance_state='missing' THEN true
              WHEN e.compliance_state='expired' THEN e.block_when_expired
              WHEN e.compliance_state='rejected' THEN e.block_when_rejected
              WHEN e.compliance_state='pending' THEN e.block_when_pending
              WHEN e.compliance_state='expiring_soon' THEN e.block_when_expiring_soon
              ELSE false END AS blocking,
         e.candidate_expires_on,
         e.warning_days,
         o.id,
         CASE
           WHEN o.id IS NOT NULL THEN 'administrative override active'
           WHEN e.compliance_state='missing' THEN 'required document is missing'
           WHEN e.compliance_state='expired' THEN 'document is expired'
           WHEN e.compliance_state='rejected' THEN 'document is rejected or blocked'
           WHEN e.compliance_state='pending' THEN 'document validation is pending'
           WHEN e.compliance_state='expiring_soon' THEN 'document is inside the warning window'
           ELSE 'document is compliant'
         END
    FROM evaluated e
    LEFT JOIN LATERAL (
      SELECT x.id
        FROM document_compliance_overrides x
       WHERE x.context=p_context
         AND x.subject_scope=p_subject_scope
         AND x.subject_id=p_subject_id
         AND x.document_type_id=e.document_type_id
         AND x.valid_until > clock_timestamp()
       ORDER BY x.created_at DESC
       LIMIT 1
    ) o ON true
   ORDER BY e.name,e.document_type_id;
END
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_assert_document_compliance"(
  p_subject_scope text,
  p_subject_id uuid,
  p_context text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_failure record;
BEGIN
  SELECT * INTO v_failure
    FROM nexora_evaluate_document_compliance(p_subject_scope,p_subject_id,p_context)
   WHERE blocking
   ORDER BY document_type_name
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE='P0001',
      MESSAGE=format('document compliance blocked: %s (%s) - %s',v_failure.document_type_name,v_failure.state,v_failure.reason);
  END IF;
END
$$;--> statement-breakpoint

CREATE FUNCTION "nexora_contract_document_compliance_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status='confirmed' AND (
       TG_OP='INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.driver_id IS DISTINCT FROM NEW.driver_id
       OR OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id
       OR OLD.carrier_party_id IS DISTINCT FROM NEW.carrier_party_id
     ) THEN
    PERFORM nexora_assert_document_compliance('driver',NEW.driver_id,'contracting');
    PERFORM nexora_assert_document_compliance('asset',NEW.vehicle_id,'contracting');
    PERFORM nexora_assert_document_compliance('party',NEW.carrier_party_id,'contracting');
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "transport_contracts_document_compliance_guard"
BEFORE INSERT OR UPDATE OF status,driver_id,vehicle_id,carrier_party_id ON "transport_contracts"
FOR EACH ROW EXECUTE FUNCTION "nexora_contract_document_compliance_guard"();--> statement-breakpoint

CREATE FUNCTION "nexora_trip_document_compliance_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_subject uuid;
BEGIN
  IF NEW.status IN ('ready','in_transit') AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR v_subject IN
      SELECT driver_id FROM trip_drivers
       WHERE trip_id=NEW.id AND ends_at IS NULL
    LOOP
      PERFORM nexora_assert_document_compliance('driver',v_subject,'trip');
    END LOOP;

    FOR v_subject IN
      SELECT asset_id FROM trip_assets
       WHERE trip_id=NEW.id AND ends_at IS NULL
    LOOP
      PERFORM nexora_assert_document_compliance('asset',v_subject,'trip');
    END LOOP;

    FOR v_subject IN
      SELECT DISTINCT c.carrier_party_id
        FROM trip_transport_requests l
        JOIN transport_contracts c
          ON c.tenant_id=l.tenant_id AND c.id=l.transport_contract_id
       WHERE l.trip_id=NEW.id AND l.removed_at IS NULL
    LOOP
      PERFORM nexora_assert_document_compliance('party',v_subject,'trip');
    END LOOP;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "trips_document_compliance_guard"
BEFORE UPDATE OF status ON "trips"
FOR EACH ROW EXECUTE FUNCTION "nexora_trip_document_compliance_guard"();--> statement-breakpoint

CREATE FUNCTION "nexora_active_trip_capacity_document_compliance_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_trip_status text;
BEGIN
  SELECT status::text INTO v_trip_status FROM trips WHERE id=NEW.trip_id;
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
CREATE TRIGGER "trip_drivers_document_compliance_guard"
BEFORE INSERT OR UPDATE OF driver_id,ends_at ON "trip_drivers"
FOR EACH ROW EXECUTE FUNCTION "nexora_active_trip_capacity_document_compliance_guard"();--> statement-breakpoint
CREATE TRIGGER "trip_assets_document_compliance_guard"
BEFORE INSERT OR UPDATE OF asset_id,ends_at ON "trip_assets"
FOR EACH ROW EXECUTE FUNCTION "nexora_active_trip_capacity_document_compliance_guard"();--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE ON TABLE "document_compliance_policies" TO nexora_app;--> statement-breakpoint
REVOKE DELETE ON TABLE "document_compliance_policies" FROM nexora_app;--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "document_compliance_overrides" TO nexora_app;--> statement-breakpoint
REVOKE UPDATE, DELETE ON TABLE "document_compliance_overrides" FROM nexora_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_evaluate_document_compliance"(text,uuid,text) TO nexora_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_assert_document_compliance"(text,uuid,text) TO nexora_app;