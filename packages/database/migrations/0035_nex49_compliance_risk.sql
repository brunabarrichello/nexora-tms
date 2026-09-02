CREATE TABLE "compliance_risk_assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "subject_scope" varchar(24) NOT NULL,
  "subject_id" uuid NOT NULL,
  "source" varchar(24) DEFAULT 'system' NOT NULL,
  "decision" varchar(24) NOT NULL,
  "score" integer NOT NULL,
  "reason" varchar(1500) NOT NULL,
  "rules_version" varchar(40) NOT NULL,
  "signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "provider" varchar(80),
  "provider_reference" varchar(180),
  "provider_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "supersedes_assessment_id" uuid,
  "assessed_by_user_id" uuid NOT NULL,
  "assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "compliance_risk_assessments_tenant_id_id_unique" UNIQUE("tenant_id","id"),
  CONSTRAINT "compliance_risk_assessments_scope_check" CHECK ("subject_scope" in ('party','driver','asset','document')),
  CONSTRAINT "compliance_risk_assessments_source_check" CHECK ("source" in ('system','manual','external')),
  CONSTRAINT "compliance_risk_assessments_decision_check" CHECK ("decision" in ('approve','review','block')),
  CONSTRAINT "compliance_risk_assessments_score_check" CHECK ("score" >= 0 AND "score" <= 100),
  CONSTRAINT "compliance_risk_assessments_reason_check" CHECK (length(trim("reason")) >= 10),
  CONSTRAINT "compliance_risk_assessments_rules_version_check" CHECK (length(trim("rules_version")) > 0),
  CONSTRAINT "compliance_risk_assessments_signals_check" CHECK (jsonb_typeof("signals") = 'array'),
  CONSTRAINT "compliance_risk_assessments_provider_details_check" CHECK (jsonb_typeof("provider_details") = 'object'),
  CONSTRAINT "compliance_risk_assessments_external_provider_check" CHECK ("source" <> 'external' OR length(trim(coalesce("provider", ''))) > 0),
  CONSTRAINT "compliance_risk_assessments_provider_reference_check" CHECK ("provider_reference" IS NULL OR length(trim(coalesce("provider", ''))) > 0),
  CONSTRAINT "compliance_risk_assessments_manual_supersedes_check" CHECK ("source" <> 'manual' OR "supersedes_assessment_id" IS NOT NULL),
  CONSTRAINT "compliance_risk_assessments_not_self_superseding_check" CHECK ("supersedes_assessment_id" IS NULL OR "supersedes_assessment_id" <> "id")
);--> statement-breakpoint
ALTER TABLE "compliance_risk_assessments" ADD CONSTRAINT "compliance_risk_assessments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_risk_assessments" ADD CONSTRAINT "compliance_risk_assessments_assessed_by_user_id_users_id_fk" FOREIGN KEY ("assessed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_risk_assessments" ADD CONSTRAINT "compliance_risk_assessments_supersedes_fk" FOREIGN KEY ("tenant_id","supersedes_assessment_id") REFERENCES "public"."compliance_risk_assessments"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compliance_risk_assessments_subject_time_idx" ON "compliance_risk_assessments" USING btree ("tenant_id","subject_scope","subject_id","assessed_at" DESC);--> statement-breakpoint
CREATE INDEX "compliance_risk_assessments_decision_time_idx" ON "compliance_risk_assessments" USING btree ("tenant_id","decision","assessed_at" DESC);--> statement-breakpoint
ALTER TABLE "compliance_risk_assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "compliance_risk_assessments_tenant_isolation" ON "compliance_risk_assessments" AS PERMISSIVE FOR ALL TO public USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

CREATE FUNCTION "nexora_compliance_risk_assessment_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_subject_exists boolean;
  v_previous record;
BEGIN
  IF NEW.subject_scope = 'party' THEN
    SELECT EXISTS(
      SELECT 1 FROM business_parties
       WHERE tenant_id=NEW.tenant_id AND id=NEW.subject_id
    ) INTO v_subject_exists;
  ELSIF NEW.subject_scope = 'driver' THEN
    SELECT EXISTS(
      SELECT 1 FROM drivers
       WHERE tenant_id=NEW.tenant_id AND id=NEW.subject_id
    ) INTO v_subject_exists;
  ELSIF NEW.subject_scope = 'asset' THEN
    SELECT EXISTS(
      SELECT 1 FROM capacity_assets
       WHERE tenant_id=NEW.tenant_id AND id=NEW.subject_id
    ) INTO v_subject_exists;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM documents
       WHERE tenant_id=NEW.tenant_id AND id=NEW.subject_id AND deleted_at IS NULL
    ) INTO v_subject_exists;
  END IF;

  IF NOT v_subject_exists THEN
    RAISE EXCEPTION 'risk assessment subject does not exist in current tenant';
  END IF;

  IF NEW.supersedes_assessment_id IS NOT NULL THEN
    SELECT subject_scope,subject_id INTO v_previous
      FROM compliance_risk_assessments
     WHERE tenant_id=NEW.tenant_id
       AND id=NEW.supersedes_assessment_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'superseded risk assessment does not exist in current tenant';
    END IF;
    IF v_previous.subject_scope <> NEW.subject_scope OR v_previous.subject_id <> NEW.subject_id THEN
      RAISE EXCEPTION 'superseded risk assessment must refer to the same subject';
    END IF;
  END IF;

  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "compliance_risk_assessments_subject_guard"
BEFORE INSERT ON "compliance_risk_assessments"
FOR EACH ROW EXECUTE FUNCTION "nexora_compliance_risk_assessment_guard"();--> statement-breakpoint

CREATE FUNCTION "nexora_prevent_compliance_risk_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE='55000',
    MESSAGE='compliance risk assessments are append-only';
END
$$;--> statement-breakpoint
CREATE TRIGGER "compliance_risk_assessments_immutable"
BEFORE UPDATE OR DELETE ON "compliance_risk_assessments"
FOR EACH ROW EXECUTE FUNCTION "nexora_prevent_compliance_risk_mutation"();--> statement-breakpoint

CREATE FUNCTION "nexora_audit_compliance_risk_assessment"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO audit_events (
    tenant_id,action,outcome,source,entity_type,entity_id,
    actor_type,actor_user_id,reason,metadata
  ) VALUES (
    NEW.tenant_id,
    CASE WHEN NEW.source='manual' THEN 'compliance.risk.decided' ELSE 'compliance.risk.assessed' END,
    'success',
    CASE WHEN NEW.source='manual' THEN 'api' WHEN NEW.source='external' THEN 'integration' ELSE 'system' END,
    'compliance_risk_assessment',
    NEW.id::text,
    'user',
    NEW.assessed_by_user_id,
    NEW.reason,
    jsonb_build_object(
      'subjectScope',NEW.subject_scope,
      'subjectId',NEW.subject_id,
      'decision',NEW.decision,
      'score',NEW.score,
      'rulesVersion',NEW.rules_version,
      'assessmentSource',NEW.source,
      'provider',NEW.provider,
      'supersedesAssessmentId',NEW.supersedes_assessment_id
    )
  );
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "compliance_risk_assessments_audit"
AFTER INSERT ON "compliance_risk_assessments"
FOR EACH ROW EXECUTE FUNCTION "nexora_audit_compliance_risk_assessment"();--> statement-breakpoint

GRANT SELECT, INSERT ON TABLE "compliance_risk_assessments" TO nexora_app;--> statement-breakpoint
REVOKE UPDATE, DELETE ON TABLE "compliance_risk_assessments" FROM nexora_app;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_compliance_risk_assessment_guard"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_prevent_compliance_risk_mutation"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_audit_compliance_risk_assessment"() FROM PUBLIC;
