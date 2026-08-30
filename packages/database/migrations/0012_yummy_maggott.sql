CREATE TYPE "public"."freight_proposal_kind" AS ENUM('proposal', 'counterproposal');--> statement-breakpoint
CREATE TYPE "public"."freight_proposal_status" AS ENUM('open', 'accepted', 'rejected', 'expired');--> statement-breakpoint
CREATE TABLE "freight_proposal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"status" "freight_proposal_status" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freight_proposal_events_status_unique" UNIQUE("tenant_id","proposal_id","status"),
	CONSTRAINT "freight_proposal_events_reason_check" CHECK ("freight_proposal_events"."status" <> 'rejected' OR length(trim(coalesce("freight_proposal_events"."reason", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "freight_proposal_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "freight_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"capacity_assignment_id" uuid NOT NULL,
	"carrier_party_id" uuid NOT NULL,
	"parent_proposal_id" uuid,
	"sequence" integer NOT NULL,
	"kind" "freight_proposal_kind" NOT NULL,
	"currency_code" varchar(3) DEFAULT 'BRL' NOT NULL,
	"freight_amount" numeric(14, 2) NOT NULL,
	"toll_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"additional_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_terms" varchar(300) NOT NULL,
	"commercial_notes" varchar(1000),
	"expires_at" timestamp with time zone,
	"authored_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freight_proposals_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "freight_proposals_request_sequence_unique" UNIQUE("tenant_id","transport_request_id","sequence"),
	CONSTRAINT "freight_proposals_sequence_check" CHECK ("freight_proposals"."sequence" > 0),
	CONSTRAINT "freight_proposals_currency_check" CHECK ("freight_proposals"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "freight_proposals_freight_amount_check" CHECK ("freight_proposals"."freight_amount" > 0),
	CONSTRAINT "freight_proposals_toll_amount_check" CHECK ("freight_proposals"."toll_amount" >= 0),
	CONSTRAINT "freight_proposals_additional_amount_check" CHECK ("freight_proposals"."additional_amount" >= 0),
	CONSTRAINT "freight_proposals_payment_terms_check" CHECK (length(trim("freight_proposals"."payment_terms")) > 0),
	CONSTRAINT "freight_proposals_parent_kind_check" CHECK (("freight_proposals"."kind" = 'proposal' AND "freight_proposals"."parent_proposal_id" IS NULL) OR ("freight_proposals"."kind" = 'counterproposal' AND "freight_proposals"."parent_proposal_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "freight_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "freight_proposal_events" ADD CONSTRAINT "freight_proposal_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_proposal_events" ADD CONSTRAINT "freight_proposal_events_proposal_fk" FOREIGN KEY ("tenant_id","proposal_id") REFERENCES "public"."freight_proposals"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_proposals" ADD CONSTRAINT "freight_proposals_authored_by_user_id_users_id_fk" FOREIGN KEY ("authored_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_proposals" ADD CONSTRAINT "freight_proposals_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_proposals" ADD CONSTRAINT "freight_proposals_capacity_assignment_fk" FOREIGN KEY ("tenant_id","capacity_assignment_id") REFERENCES "public"."capacity_assignments"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_proposals" ADD CONSTRAINT "freight_proposals_carrier_party_fk" FOREIGN KEY ("tenant_id","carrier_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_proposals" ADD CONSTRAINT "freight_proposals_parent_fk" FOREIGN KEY ("tenant_id","parent_proposal_id") REFERENCES "public"."freight_proposals"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "freight_proposal_events_proposal_created_idx" ON "freight_proposal_events" USING btree ("tenant_id","proposal_id","created_at");--> statement-breakpoint
CREATE INDEX "freight_proposals_request_created_idx" ON "freight_proposals" USING btree ("tenant_id","transport_request_id","created_at");--> statement-breakpoint
CREATE INDEX "freight_proposals_assignment_idx" ON "freight_proposals" USING btree ("tenant_id","capacity_assignment_id","created_at");--> statement-breakpoint
CREATE INDEX "freight_proposals_carrier_idx" ON "freight_proposals" USING btree ("tenant_id","carrier_party_id","created_at");--> statement-breakpoint
CREATE POLICY "freight_proposal_events_tenant_isolation" ON "freight_proposal_events" AS PERMISSIVE FOR ALL TO public USING ("freight_proposal_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("freight_proposal_events"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "freight_proposals_tenant_isolation" ON "freight_proposals" AS PERMISSIVE FOR ALL TO public USING ("freight_proposals"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("freight_proposals"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE freight_proposals TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE freight_proposal_events TO nexora_app;
