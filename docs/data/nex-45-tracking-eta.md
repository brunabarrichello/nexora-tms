# NEX-45 — External Tracking and ETA

## Scope

NEX-45 extends Wave 0023 without creating a parallel tracking aggregate. `trip_locations` remains the canonical append-only history.

## Provider boundary

External telemetry providers are represented by `TrackingProviderAdapter`. Provider-specific HTTP/SDK concerns stay outside the Trips domain; normalized events enter through `POST /api/v1/trips/:tripId/tracking/providers/:provider/events`.

Provider ingestion requires a provider event identifier and therefore preserves the Wave 0023 idempotency key `(tenant_id, provider, provider_event_id)`.

## Current tracking snapshot

`GET /api/v1/trips/:tripId/tracking` returns the newest retained position, its capture/receive timestamps, ETA when available, and a computed `stale` flag based on the policy stored with that sample. Tracking remains readable after a trip is completed or cancelled.

## Policy

Defaults:

- stale after: 900 seconds;
- retention: 90 days.

Environment overrides:

- `TRACKING_STALE_AFTER_SECONDS` (60..86400);
- `TRACKING_RETENTION_DAYS` (1..3650);
- `TRACKING_PROVIDER_POLICIES_JSON` for provider-specific overrides.

The effective policy is persisted on each location sample so historical interpretation does not drift when configuration changes later.

## Retention

`nexora_app` remains append-only for `trip_locations`: no UPDATE/DELETE grant is introduced.

Expired records are removed only through the bounded `nexora_purge_expired_trip_locations(batch_size)` database primitive. PUBLIC access is revoked and EXECUTE is granted only to `nexora_worker`.

Scheduling of the retention job is infrastructure/runtime policy; the database primitive is idempotent and safe for repeated Worker execution.

## Security

All reads and writes remain inside TenantContext + PostgreSQL RLS. Provider identifiers are configuration/integration keys, never tenant authority.
