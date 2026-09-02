ALTER TYPE "public"."capacity_reservation_event_type" ADD VALUE 'released';--> statement-breakpoint
ALTER TYPE "public"."capacity_reservation_status" ADD VALUE 'released';--> statement-breakpoint
ALTER TYPE "public"."transport_contract_event_type" ADD VALUE 'fulfilled';--> statement-breakpoint
ALTER TYPE "public"."transport_contract_status" ADD VALUE 'fulfilled';--> statement-breakpoint
ALTER TABLE "capacity_reservation_events" DROP CONSTRAINT "capacity_reservation_events_reason_check";--> statement-breakpoint
ALTER TABLE "capacity_reservations" DROP CONSTRAINT "capacity_reservations_state_check";--> statement-breakpoint
ALTER TABLE "transport_contracts" DROP CONSTRAINT "transport_contracts_state_check";--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD COLUMN "released_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD COLUMN "released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD COLUMN "release_reason" varchar(1000);--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD COLUMN "fulfilled_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD COLUMN "fulfilled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD CONSTRAINT "capacity_reservations_released_by_user_id_users_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_fulfilled_by_user_id_users_id_fk" FOREIGN KEY ("fulfilled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_reservation_events" ADD CONSTRAINT "capacity_reservation_events_reason_check" CHECK ("capacity_reservation_events"."type" = 'approved' OR length(trim(coalesce("capacity_reservation_events"."reason", ''))) > 0);--> statement-breakpoint
ALTER TABLE "capacity_reservations" ADD CONSTRAINT "capacity_reservations_state_check" CHECK ((
        "capacity_reservations"."status" = 'active'
        AND "capacity_reservations"."cancelled_by_user_id" IS NULL
        AND "capacity_reservations"."cancelled_at" IS NULL
        AND "capacity_reservations"."cancel_reason" IS NULL
        AND "capacity_reservations"."released_by_user_id" IS NULL
        AND "capacity_reservations"."released_at" IS NULL
        AND "capacity_reservations"."release_reason" IS NULL
      ) OR (
        "capacity_reservations"."status" = 'cancelled'
        AND "capacity_reservations"."cancelled_by_user_id" IS NOT NULL
        AND "capacity_reservations"."cancelled_at" IS NOT NULL
        AND length(trim(coalesce("capacity_reservations"."cancel_reason", ''))) > 0
        AND "capacity_reservations"."released_by_user_id" IS NULL
        AND "capacity_reservations"."released_at" IS NULL
        AND "capacity_reservations"."release_reason" IS NULL
      ) OR (
        "capacity_reservations"."status" = 'released'
        AND "capacity_reservations"."cancelled_by_user_id" IS NULL
        AND "capacity_reservations"."cancelled_at" IS NULL
        AND "capacity_reservations"."cancel_reason" IS NULL
        AND "capacity_reservations"."released_by_user_id" IS NOT NULL
        AND "capacity_reservations"."released_at" IS NOT NULL
        AND length(trim(coalesce("capacity_reservations"."release_reason", ''))) > 0
      ));--> statement-breakpoint
ALTER TABLE "transport_contracts" ADD CONSTRAINT "transport_contracts_state_check" CHECK ((
        "transport_contracts"."status" = 'confirmed'
        AND "transport_contracts"."confirmed_by_user_id" IS NOT NULL
        AND "transport_contracts"."confirmed_at" IS NOT NULL
        AND "transport_contracts"."fulfilled_by_user_id" IS NULL
        AND "transport_contracts"."fulfilled_at" IS NULL
        AND "transport_contracts"."refused_by_user_id" IS NULL
        AND "transport_contracts"."refused_at" IS NULL
        AND "transport_contracts"."refusal_reason" IS NULL
        AND "transport_contracts"."cancelled_by_user_id" IS NULL
        AND "transport_contracts"."cancelled_at" IS NULL
        AND "transport_contracts"."cancel_reason" IS NULL
      ) OR (
        "transport_contracts"."status" = 'fulfilled'
        AND "transport_contracts"."confirmed_by_user_id" IS NOT NULL
        AND "transport_contracts"."confirmed_at" IS NOT NULL
        AND "transport_contracts"."fulfilled_by_user_id" IS NOT NULL
        AND "transport_contracts"."fulfilled_at" IS NOT NULL
        AND "transport_contracts"."refused_by_user_id" IS NULL
        AND "transport_contracts"."refused_at" IS NULL
        AND "transport_contracts"."refusal_reason" IS NULL
        AND "transport_contracts"."cancelled_by_user_id" IS NULL
        AND "transport_contracts"."cancelled_at" IS NULL
        AND "transport_contracts"."cancel_reason" IS NULL
      ) OR (
        "transport_contracts"."status" = 'refused'
        AND "transport_contracts"."confirmed_by_user_id" IS NULL
        AND "transport_contracts"."confirmed_at" IS NULL
        AND "transport_contracts"."fulfilled_by_user_id" IS NULL
        AND "transport_contracts"."fulfilled_at" IS NULL
        AND "transport_contracts"."refused_by_user_id" IS NOT NULL
        AND "transport_contracts"."refused_at" IS NOT NULL
        AND length(trim(coalesce("transport_contracts"."refusal_reason", ''))) > 0
        AND "transport_contracts"."cancelled_by_user_id" IS NULL
        AND "transport_contracts"."cancelled_at" IS NULL
        AND "transport_contracts"."cancel_reason" IS NULL
      ) OR (
        "transport_contracts"."status" = 'cancelled'
        AND "transport_contracts"."confirmed_by_user_id" IS NOT NULL
        AND "transport_contracts"."confirmed_at" IS NOT NULL
        AND "transport_contracts"."fulfilled_by_user_id" IS NULL
        AND "transport_contracts"."fulfilled_at" IS NULL
        AND "transport_contracts"."refused_by_user_id" IS NULL
        AND "transport_contracts"."refused_at" IS NULL
        AND "transport_contracts"."refusal_reason" IS NULL
        AND "transport_contracts"."cancelled_by_user_id" IS NOT NULL
        AND "transport_contracts"."cancelled_at" IS NOT NULL
        AND length(trim(coalesce("transport_contracts"."cancel_reason", ''))) > 0
      ));