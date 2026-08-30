CREATE TYPE "public"."matching_candidate_status" AS ENUM('eligible', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."matching_rule_category" AS ENUM('eligibility', 'capacity', 'equipment', 'compliance', 'availability', 'commercial', 'preference');--> statement-breakpoint
CREATE TYPE "public"."matching_rule_impact" AS ENUM('blocker', 'penalty', 'bonus', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."matching_rule_result" AS ENUM('passed', 'failed', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."matching_run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "matching_candidate_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"matching_candidate_id" uuid NOT NULL,
	"dimension_code" varchar(96) NOT NULL,
	"raw_score" numeric(9, 4) NOT NULL,
	"weight" numeric(8, 4) DEFAULT '1' NOT NULL,
	"weighted_score" numeric(9, 4) NOT NULL,
	"rationale" varchar(1000),
	"input_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matching_candidate_scores_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "matching_candidate_scores_candidate_dimension_unique" UNIQUE("tenant_id","matching_candidate_id","dimension_code"),
	CONSTRAINT "matching_candidate_scores_raw_check" CHECK ("matching_candidate_scores"."raw_score" >= 0 AND "matching_candidate_scores"."raw_score" <= 100),
	CONSTRAINT "matching_candidate_scores_weight_check" CHECK ("matching_candidate_scores"."weight" >= 0)
);
--> statement-breakpoint
ALTER TABLE "matching_candidate_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matching_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"matching_run_id" uuid NOT NULL,
	"capacity_assignment_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"capacity_asset_id" uuid NOT NULL,
	"carrier_party_id" uuid NOT NULL,
	"status" "matching_candidate_status" NOT NULL,
	"rank" integer,
	"total_score" numeric(9, 4) DEFAULT '0' NOT NULL,
	"blocking_reason_count" integer DEFAULT 0 NOT NULL,
	"explanation_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"candidate_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matching_candidates_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "matching_candidates_run_assignment_unique" UNIQUE("tenant_id","matching_run_id","capacity_assignment_id"),
	CONSTRAINT "matching_candidates_rank_check" CHECK ("matching_candidates"."rank" IS NULL OR "matching_candidates"."rank" > 0),
	CONSTRAINT "matching_candidates_score_check" CHECK ("matching_candidates"."total_score" >= 0 AND "matching_candidates"."total_score" <= 100),
	CONSTRAINT "matching_candidates_blocking_count_check" CHECK ("matching_candidates"."blocking_reason_count" >= 0),
	CONSTRAINT "matching_candidates_status_check" CHECK (("matching_candidates"."status" = 'eligible' AND "matching_candidates"."blocking_reason_count" = 0) OR ("matching_candidates"."status" = 'rejected' AND "matching_candidates"."blocking_reason_count" > 0))
);
--> statement-breakpoint
ALTER TABLE "matching_candidates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matching_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"minimum_score" numeric(7, 4) DEFAULT '0' NOT NULL,
	"max_candidates" integer DEFAULT 100 NOT NULL,
	"include_rejected" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matching_preferences_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "matching_preferences_tenant_name_unique" UNIQUE("tenant_id","name"),
	CONSTRAINT "matching_preferences_minimum_score_check" CHECK ("matching_preferences"."minimum_score" >= 0 AND "matching_preferences"."minimum_score" <= 100),
	CONSTRAINT "matching_preferences_max_candidates_check" CHECK ("matching_preferences"."max_candidates" > 0)
);
--> statement-breakpoint
ALTER TABLE "matching_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matching_rejections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"matching_candidate_id" uuid NOT NULL,
	"matching_rule_result_id" uuid,
	"code" varchar(96) NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matching_rejections_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "matching_rejections_code_check" CHECK (length(trim("matching_rejections"."code")) >= 2)
);
--> statement-breakpoint
ALTER TABLE "matching_rejections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matching_rule_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"matching_candidate_id" uuid NOT NULL,
	"matching_rule_id" uuid NOT NULL,
	"rule_code" varchar(96) NOT NULL,
	"rule_version" integer NOT NULL,
	"result" "matching_rule_result" NOT NULL,
	"impact" "matching_rule_impact" NOT NULL,
	"score_delta" numeric(9, 4) DEFAULT '0' NOT NULL,
	"message" varchar(1000) NOT NULL,
	"required_value" jsonb,
	"actual_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matching_rule_results_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "matching_rule_results_candidate_rule_unique" UNIQUE("tenant_id","matching_candidate_id","matching_rule_id"),
	CONSTRAINT "matching_rule_results_version_check" CHECK ("matching_rule_results"."rule_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "matching_rule_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matching_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(96) NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" varchar(1000),
	"category" "matching_rule_category" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_blocking" boolean DEFAULT false NOT NULL,
	"weight" numeric(8, 4) DEFAULT '1' NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matching_rules_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "matching_rules_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "matching_rules_code_check" CHECK (length(trim("matching_rules"."code")) >= 2),
	CONSTRAINT "matching_rules_version_check" CHECK ("matching_rules"."version" > 0),
	CONSTRAINT "matching_rules_weight_check" CHECK ("matching_rules"."weight" >= 0)
);
--> statement-breakpoint
ALTER TABLE "matching_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matching_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"preference_id" uuid,
	"status" "matching_run_status" DEFAULT 'queued' NOT NULL,
	"algorithm_version" varchar(64) NOT NULL,
	"parameters_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rules_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evaluated_count" integer DEFAULT 0 NOT NULL,
	"eligible_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_code" varchar(96),
	"failure_message" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matching_runs_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "matching_runs_counts_check" CHECK ("matching_runs"."evaluated_count" >= 0 AND "matching_runs"."eligible_count" >= 0 AND "matching_runs"."rejected_count" >= 0 AND "matching_runs"."evaluated_count" = "matching_runs"."eligible_count" + "matching_runs"."rejected_count"),
	CONSTRAINT "matching_runs_period_check" CHECK ("matching_runs"."completed_at" IS NULL OR ("matching_runs"."started_at" IS NOT NULL AND "matching_runs"."completed_at" >= "matching_runs"."started_at")),
	CONSTRAINT "matching_runs_failure_check" CHECK ("matching_runs"."status" <> 'failed' OR ("matching_runs"."failure_code" IS NOT NULL AND "matching_runs"."failure_message" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "matching_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "matching_candidate_scores" ADD CONSTRAINT "matching_candidate_scores_candidate_fk" FOREIGN KEY ("tenant_id","matching_candidate_id") REFERENCES "public"."matching_candidates"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_candidates" ADD CONSTRAINT "matching_candidates_run_fk" FOREIGN KEY ("tenant_id","matching_run_id") REFERENCES "public"."matching_runs"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_candidates" ADD CONSTRAINT "matching_candidates_assignment_fk" FOREIGN KEY ("tenant_id","capacity_assignment_id") REFERENCES "public"."capacity_assignments"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_candidates" ADD CONSTRAINT "matching_candidates_driver_fk" FOREIGN KEY ("tenant_id","driver_id") REFERENCES "public"."drivers"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_candidates" ADD CONSTRAINT "matching_candidates_asset_fk" FOREIGN KEY ("tenant_id","capacity_asset_id") REFERENCES "public"."capacity_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_candidates" ADD CONSTRAINT "matching_candidates_carrier_fk" FOREIGN KEY ("tenant_id","carrier_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_rejections" ADD CONSTRAINT "matching_rejections_candidate_fk" FOREIGN KEY ("tenant_id","matching_candidate_id") REFERENCES "public"."matching_candidates"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_rejections" ADD CONSTRAINT "matching_rejections_rule_result_fk" FOREIGN KEY ("tenant_id","matching_rule_result_id") REFERENCES "public"."matching_rule_results"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_rule_results" ADD CONSTRAINT "matching_rule_results_candidate_fk" FOREIGN KEY ("tenant_id","matching_candidate_id") REFERENCES "public"."matching_candidates"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_rule_results" ADD CONSTRAINT "matching_rule_results_rule_fk" FOREIGN KEY ("tenant_id","matching_rule_id") REFERENCES "public"."matching_rules"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_runs" ADD CONSTRAINT "matching_runs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_runs" ADD CONSTRAINT "matching_runs_transport_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_runs" ADD CONSTRAINT "matching_runs_preference_fk" FOREIGN KEY ("tenant_id","preference_id") REFERENCES "public"."matching_preferences"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matching_candidate_scores_tenant_candidate_idx" ON "matching_candidate_scores" USING btree ("tenant_id","matching_candidate_id");--> statement-breakpoint
CREATE INDEX "matching_candidates_tenant_run_rank_idx" ON "matching_candidates" USING btree ("tenant_id","matching_run_id","rank");--> statement-breakpoint
CREATE INDEX "matching_candidates_tenant_run_status_idx" ON "matching_candidates" USING btree ("tenant_id","matching_run_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "matching_preferences_tenant_default_unique" ON "matching_preferences" USING btree ("tenant_id") WHERE "matching_preferences"."is_default" = true AND "matching_preferences"."is_active" = true;--> statement-breakpoint
CREATE INDEX "matching_preferences_tenant_active_idx" ON "matching_preferences" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "matching_rejections_tenant_candidate_idx" ON "matching_rejections" USING btree ("tenant_id","matching_candidate_id","created_at");--> statement-breakpoint
CREATE INDEX "matching_rejections_tenant_code_idx" ON "matching_rejections" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "matching_rule_results_tenant_candidate_result_idx" ON "matching_rule_results" USING btree ("tenant_id","matching_candidate_id","result");--> statement-breakpoint
CREATE INDEX "matching_rules_tenant_active_category_idx" ON "matching_rules" USING btree ("tenant_id","is_active","category");--> statement-breakpoint
CREATE INDEX "matching_runs_tenant_request_created_idx" ON "matching_runs" USING btree ("tenant_id","transport_request_id","created_at");--> statement-breakpoint
CREATE INDEX "matching_runs_tenant_status_idx" ON "matching_runs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE POLICY "matching_candidate_scores_tenant_isolation" ON "matching_candidate_scores" AS PERMISSIVE FOR ALL TO public USING ("matching_candidate_scores"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("matching_candidate_scores"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "matching_candidates_tenant_isolation" ON "matching_candidates" AS PERMISSIVE FOR ALL TO public USING ("matching_candidates"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("matching_candidates"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "matching_preferences_tenant_isolation" ON "matching_preferences" AS PERMISSIVE FOR ALL TO public USING ("matching_preferences"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("matching_preferences"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "matching_rejections_tenant_isolation" ON "matching_rejections" AS PERMISSIVE FOR ALL TO public USING ("matching_rejections"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("matching_rejections"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "matching_rule_results_tenant_isolation" ON "matching_rule_results" AS PERMISSIVE FOR ALL TO public USING ("matching_rule_results"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("matching_rule_results"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "matching_rules_tenant_isolation" ON "matching_rules" AS PERMISSIVE FOR ALL TO public USING ("matching_rules"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("matching_rules"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "matching_runs_tenant_isolation" ON "matching_runs" AS PERMISSIVE FOR ALL TO public USING ("matching_runs"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("matching_runs"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON TABLE matching_rules, matching_preferences, matching_runs TO nexora_app;
GRANT SELECT, INSERT ON TABLE matching_candidates, matching_candidate_scores, matching_rule_results, matching_rejections TO nexora_app;
