ALTER TABLE "webhook_subscriptions"
  ALTER COLUMN "revoked_reason" TYPE varchar(1200);--> statement-breakpoint

CREATE OR REPLACE FUNCTION "nexora_sync_webhook_delivery_from_job"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.job_type <> 'integrations.webhook.deliver' OR NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  UPDATE webhook_deliveries
     SET status = CASE
           WHEN status = 'cancelled' AND NEW.status = 'succeeded' THEN 'cancelled'
           WHEN NEW.status = 'pending' THEN 'queued'
           WHEN NEW.status = 'retry_wait' THEN 'retry_wait'
           WHEN NEW.status = 'succeeded' THEN 'succeeded'
           WHEN NEW.status = 'dead_lettered' THEN 'dead_lettered'
           WHEN NEW.status = 'cancelled' THEN 'cancelled'
           ELSE status
         END,
         succeeded_at = CASE
           WHEN status = 'cancelled' AND NEW.status = 'succeeded' THEN NULL
           WHEN NEW.status = 'succeeded' THEN coalesce(succeeded_at, now())
           WHEN NEW.status IN ('pending','retry_wait') THEN NULL
           ELSE succeeded_at
         END,
         dead_lettered_at = CASE
           WHEN NEW.status = 'dead_lettered' THEN coalesce(dead_lettered_at, now())
           WHEN NEW.status IN ('pending','retry_wait') THEN NULL
           ELSE dead_lettered_at
         END,
         cancelled_at = CASE
           WHEN status = 'cancelled' AND NEW.status = 'succeeded' THEN coalesce(cancelled_at, now())
           WHEN NEW.status = 'cancelled' THEN coalesce(cancelled_at, now())
           WHEN NEW.status IN ('pending','retry_wait') THEN NULL
           ELSE cancelled_at
         END,
         updated_at = now()
   WHERE tenant_id = NEW.tenant_id
     AND durable_job_id = NEW.id;

  RETURN NEW;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION "nexora_sync_webhook_delivery_from_job"() FROM PUBLIC;