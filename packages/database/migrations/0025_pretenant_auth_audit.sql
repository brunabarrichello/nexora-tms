CREATE TABLE "pretenant_auth_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"outcome" varchar(24) NOT NULL,
	"provider_key" varchar(120),
	"subject_fingerprint" char(64),
	"user_id" uuid,
	"request_id" varchar(120),
	"correlation_id" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pretenant_auth_events_event_type_check" CHECK ("pretenant_auth_events"."event_type" in ('auth.bearer.missing','auth.bearer.rejected','auth.identity.unlinked','auth.identity.accepted')),
	CONSTRAINT "pretenant_auth_events_outcome_check" CHECK ("pretenant_auth_events"."outcome" in ('success','failure','denied')),
	CONSTRAINT "pretenant_auth_events_subject_fingerprint_check" CHECK ("pretenant_auth_events"."subject_fingerprint" IS NULL OR "pretenant_auth_events"."subject_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "pretenant_auth_events" ADD CONSTRAINT "pretenant_auth_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "pretenant_auth_events_occurred_idx" ON "pretenant_auth_events" USING btree ("occurred_at");
--> statement-breakpoint
CREATE INDEX "pretenant_auth_events_event_type_idx" ON "pretenant_auth_events" USING btree ("event_type","occurred_at");
--> statement-breakpoint
CREATE INDEX "pretenant_auth_events_subject_fingerprint_idx" ON "pretenant_auth_events" USING btree ("subject_fingerprint","occurred_at");
--> statement-breakpoint
CREATE TRIGGER "pretenant_auth_events_immutable"
BEFORE UPDATE OR DELETE ON "pretenant_auth_events"
FOR EACH ROW EXECUTE FUNCTION "nexora_prevent_audit_mutation"();
--> statement-breakpoint
REVOKE ALL ON TABLE "pretenant_auth_events" FROM PUBLIC;
--> statement-breakpoint
GRANT INSERT ON TABLE "pretenant_auth_events" TO nexora_app;
--> statement-breakpoint
REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "pretenant_auth_events" FROM nexora_app;