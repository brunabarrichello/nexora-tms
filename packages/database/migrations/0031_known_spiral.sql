ALTER TABLE "trip_locations" ADD COLUMN "eta_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trip_locations" ADD COLUMN "eta_source" varchar(24);--> statement-breakpoint
ALTER TABLE "trip_locations" ADD COLUMN "stale_after_seconds" integer DEFAULT 900 NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_locations" ADD COLUMN "retention_until" timestamp with time zone DEFAULT now() + interval '90 days' NOT NULL;--> statement-breakpoint
CREATE INDEX "trip_locations_retention_idx" ON "trip_locations" USING btree ("retention_until","id");--> statement-breakpoint
ALTER TABLE "trip_locations" ADD CONSTRAINT "trip_locations_eta_pair_check" CHECK (("trip_locations"."eta_at" IS NULL AND "trip_locations"."eta_source" IS NULL) OR ("trip_locations"."eta_at" IS NOT NULL AND "trip_locations"."eta_source" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "trip_locations" ADD CONSTRAINT "trip_locations_eta_source_check" CHECK ("trip_locations"."eta_source" IS NULL OR "trip_locations"."eta_source" in ('provider','calculated'));--> statement-breakpoint
ALTER TABLE "trip_locations" ADD CONSTRAINT "trip_locations_eta_time_check" CHECK ("trip_locations"."eta_at" IS NULL OR "trip_locations"."eta_at" >= "trip_locations"."recorded_at");--> statement-breakpoint
ALTER TABLE "trip_locations" ADD CONSTRAINT "trip_locations_stale_after_check" CHECK ("trip_locations"."stale_after_seconds" >= 60 AND "trip_locations"."stale_after_seconds" <= 86400);--> statement-breakpoint
ALTER TABLE "trip_locations" ADD CONSTRAINT "trip_locations_retention_check" CHECK ("trip_locations"."retention_until" > "trip_locations"."received_at");
--> statement-breakpoint
CREATE FUNCTION "nexora_purge_expired_trip_locations"(p_batch_size integer DEFAULT 1000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_batch_size < 1 OR p_batch_size > 5000 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 5000';
  END IF;

  WITH candidates AS (
    SELECT id
      FROM trip_locations
     WHERE retention_until <= clock_timestamp()
     ORDER BY retention_until, id
     FOR UPDATE SKIP LOCKED
     LIMIT p_batch_size
  ), purged AS (
    DELETE FROM trip_locations AS location
     USING candidates
     WHERE location.id = candidates.id
     RETURNING 1
  )
  SELECT count(*) INTO v_count FROM purged;

  RETURN v_count;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "nexora_purge_expired_trip_locations"(integer) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "nexora_purge_expired_trip_locations"(integer) TO nexora_worker;
