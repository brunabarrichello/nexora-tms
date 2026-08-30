CREATE TYPE "public"."negotiation_message_kind" AS ENUM('message', 'note', 'system');--> statement-breakpoint
CREATE TYPE "public"."negotiation_participant_kind" AS ENUM('internal', 'external');--> statement-breakpoint
CREATE TYPE "public"."negotiation_participant_role" AS ENUM('operator', 'commercial', 'carrier', 'driver', 'observer');--> statement-breakpoint
CREATE TYPE "public"."negotiation_thread_status" AS ENUM('open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "negotiation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"author_participant_id" uuid,
	"kind" "negotiation_message_kind" DEFAULT 'message' NOT NULL,
	"body" text NOT NULL,
	"related_proposal_id" uuid,
	"reply_to_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "negotiation_messages_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "negotiation_messages_thread_id_unique" UNIQUE("tenant_id","thread_id","id"),
	CONSTRAINT "negotiation_messages_body_check" CHECK (length(trim("negotiation_messages"."body")) BETWEEN 1 AND 8000),
	CONSTRAINT "negotiation_messages_author_check" CHECK (("negotiation_messages"."kind" = 'system' AND "negotiation_messages"."author_participant_id" IS NULL) OR ("negotiation_messages"."kind" <> 'system' AND "negotiation_messages"."author_participant_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "negotiation_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negotiation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"kind" "negotiation_participant_kind" NOT NULL,
	"role" "negotiation_participant_role" NOT NULL,
	"membership_id" uuid,
	"business_party_id" uuid,
	"business_party_contact_id" uuid,
	"added_by_membership_id" uuid NOT NULL,
	"removed_by_membership_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "negotiation_participants_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "negotiation_participants_thread_id_unique" UNIQUE("tenant_id","thread_id","id"),
	CONSTRAINT "negotiation_participants_identity_check" CHECK (("negotiation_participants"."kind" = 'internal' AND "negotiation_participants"."membership_id" IS NOT NULL AND "negotiation_participants"."business_party_id" IS NULL AND "negotiation_participants"."business_party_contact_id" IS NULL) OR ("negotiation_participants"."kind" = 'external' AND "negotiation_participants"."membership_id" IS NULL AND "negotiation_participants"."business_party_id" IS NOT NULL)),
	CONSTRAINT "negotiation_participants_removal_check" CHECK (("negotiation_participants"."left_at" IS NULL AND "negotiation_participants"."removed_by_membership_id" IS NULL) OR ("negotiation_participants"."left_at" IS NOT NULL AND "negotiation_participants"."removed_by_membership_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "negotiation_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negotiation_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transport_request_id" uuid NOT NULL,
	"subject" varchar(240) NOT NULL,
	"status" "negotiation_thread_status" DEFAULT 'open' NOT NULL,
	"created_by_membership_id" uuid NOT NULL,
	"closed_by_membership_id" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "negotiation_threads_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "negotiation_threads_tenant_request_id_unique" UNIQUE("tenant_id","transport_request_id","id"),
	CONSTRAINT "negotiation_threads_subject_check" CHECK (length(trim("negotiation_threads"."subject")) > 0),
	CONSTRAINT "negotiation_threads_close_state_check" CHECK (("negotiation_threads"."status" = 'open' AND "negotiation_threads"."closed_at" IS NULL AND "negotiation_threads"."closed_by_membership_id" IS NULL) OR ("negotiation_threads"."status" IN ('closed', 'cancelled') AND "negotiation_threads"."closed_at" IS NOT NULL AND "negotiation_threads"."closed_by_membership_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "negotiation_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_reply_to_message_id_negotiation_messages_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."negotiation_messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_thread_request_fk" FOREIGN KEY ("tenant_id","transport_request_id","thread_id") REFERENCES "public"."negotiation_threads"("tenant_id","transport_request_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_author_participant_fk" FOREIGN KEY ("tenant_id","thread_id","author_participant_id") REFERENCES "public"."negotiation_participants"("tenant_id","thread_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_messages" ADD CONSTRAINT "negotiation_messages_related_proposal_fk" FOREIGN KEY ("tenant_id","transport_request_id","related_proposal_id") REFERENCES "public"."freight_proposals"("tenant_id","transport_request_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_participants" ADD CONSTRAINT "negotiation_participants_thread_fk" FOREIGN KEY ("tenant_id","thread_id") REFERENCES "public"."negotiation_threads"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_participants" ADD CONSTRAINT "negotiation_participants_membership_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_participants" ADD CONSTRAINT "negotiation_participants_business_party_fk" FOREIGN KEY ("tenant_id","business_party_id") REFERENCES "public"."business_parties"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_participants" ADD CONSTRAINT "negotiation_participants_business_party_contact_fk" FOREIGN KEY ("tenant_id","business_party_id","business_party_contact_id") REFERENCES "public"."business_party_contacts"("tenant_id","party_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_participants" ADD CONSTRAINT "negotiation_participants_added_by_membership_fk" FOREIGN KEY ("tenant_id","added_by_membership_id") REFERENCES "public"."memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_participants" ADD CONSTRAINT "negotiation_participants_removed_by_membership_fk" FOREIGN KEY ("tenant_id","removed_by_membership_id") REFERENCES "public"."memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_threads" ADD CONSTRAINT "negotiation_threads_request_fk" FOREIGN KEY ("tenant_id","transport_request_id") REFERENCES "public"."transport_requests"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_threads" ADD CONSTRAINT "negotiation_threads_created_by_membership_fk" FOREIGN KEY ("tenant_id","created_by_membership_id") REFERENCES "public"."memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_threads" ADD CONSTRAINT "negotiation_threads_closed_by_membership_fk" FOREIGN KEY ("tenant_id","closed_by_membership_id") REFERENCES "public"."memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "negotiation_messages_thread_created_idx" ON "negotiation_messages" USING btree ("tenant_id","thread_id","created_at");--> statement-breakpoint
CREATE INDEX "negotiation_messages_proposal_idx" ON "negotiation_messages" USING btree ("tenant_id","related_proposal_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "negotiation_participants_active_internal_unique" ON "negotiation_participants" USING btree ("tenant_id","thread_id","membership_id") WHERE "negotiation_participants"."kind" = 'internal' AND "negotiation_participants"."left_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "negotiation_participants_active_external_contact_unique" ON "negotiation_participants" USING btree ("tenant_id","thread_id","business_party_id","business_party_contact_id") WHERE "negotiation_participants"."kind" = 'external' AND "negotiation_participants"."business_party_contact_id" IS NOT NULL AND "negotiation_participants"."left_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "negotiation_participants_active_external_party_unique" ON "negotiation_participants" USING btree ("tenant_id","thread_id","business_party_id") WHERE "negotiation_participants"."kind" = 'external' AND "negotiation_participants"."business_party_contact_id" IS NULL AND "negotiation_participants"."left_at" IS NULL;--> statement-breakpoint
CREATE INDEX "negotiation_participants_thread_active_idx" ON "negotiation_participants" USING btree ("tenant_id","thread_id","left_at");--> statement-breakpoint
CREATE INDEX "negotiation_threads_request_status_idx" ON "negotiation_threads" USING btree ("tenant_id","transport_request_id","status","updated_at");--> statement-breakpoint
ALTER TABLE "freight_proposals" ADD CONSTRAINT "freight_proposals_tenant_request_id_unique" UNIQUE("tenant_id","transport_request_id","id");--> statement-breakpoint
CREATE POLICY "negotiation_messages_tenant_isolation" ON "negotiation_messages" AS PERMISSIVE FOR ALL TO public USING ("negotiation_messages"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("negotiation_messages"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "negotiation_participants_tenant_isolation" ON "negotiation_participants" AS PERMISSIVE FOR ALL TO public USING ("negotiation_participants"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("negotiation_participants"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "negotiation_threads_tenant_isolation" ON "negotiation_threads" AS PERMISSIVE FOR ALL TO public USING ("negotiation_threads"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("negotiation_threads"."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE FUNCTION "public"."enforce_negotiation_message_reply_scope"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.reply_to_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1
    FROM public.negotiation_messages parent_message
   WHERE parent_message.id = NEW.reply_to_message_id
     AND parent_message.tenant_id = NEW.tenant_id
     AND parent_message.thread_id = NEW.thread_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'reply_to_message_id must reference a message in the same tenant and thread';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."enforce_negotiation_message_reply_scope"() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER "negotiation_messages_reply_scope_trigger"
BEFORE INSERT OR UPDATE OF "reply_to_message_id", "tenant_id", "thread_id"
ON "public"."negotiation_messages"
FOR EACH ROW
EXECUTE FUNCTION "public"."enforce_negotiation_message_reply_scope"();
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."negotiation_threads" FROM nexora_app;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."negotiation_participants" FROM nexora_app;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."negotiation_messages" FROM nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."negotiation_threads" TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."negotiation_participants" TO nexora_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "public"."negotiation_messages" TO nexora_app;
