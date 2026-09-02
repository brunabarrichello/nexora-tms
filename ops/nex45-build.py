from pathlib import Path
import subprocess

ROOT = Path.cwd()


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {count}")
    write(path, content.replace(old, new, 1))


# Database schema: enrich canonical append-only trip_locations rather than add parallel history.
replace_once(
    "packages/database/src/schema/trip-execution.ts",
    "  index,\n  jsonb,",
    "  index,\n  integer,\n  jsonb,",
)
replace_once(
    "packages/database/src/schema/trip-execution.ts",
    "    headingDegrees: numeric('heading_degrees', { precision: 6, scale: 2 }),\n    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),\n    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),",
    "    headingDegrees: numeric('heading_degrees', { precision: 6, scale: 2 }),\n    etaAt: timestamp('eta_at', { withTimezone: true }),\n    etaSource: varchar('eta_source', { length: 24 }),\n    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),\n    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),\n    staleAfterSeconds: integer('stale_after_seconds').default(900).notNull(),\n    retentionUntil: timestamp('retention_until', { withTimezone: true })\n      .default(sql`now() + interval '90 days'`)\n      .notNull(),",
)
replace_once(
    "packages/database/src/schema/trip-execution.ts",
    "    check(\n      'trip_locations_heading_check',\n      sql`${table.headingDegrees} IS NULL OR (${table.headingDegrees} >= 0 AND ${table.headingDegrees} < 360)`,\n    ),\n    check('trip_locations_received_check', sql`${table.receivedAt} >= ${table.recordedAt}`),",
    "    check(\n      'trip_locations_heading_check',\n      sql`${table.headingDegrees} IS NULL OR (${table.headingDegrees} >= 0 AND ${table.headingDegrees} < 360)`,\n    ),\n    check(\n      'trip_locations_eta_pair_check',\n      sql`(${table.etaAt} IS NULL AND ${table.etaSource} IS NULL) OR (${table.etaAt} IS NOT NULL AND ${table.etaSource} IS NOT NULL)`,\n    ),\n    check(\n      'trip_locations_eta_source_check',\n      sql`${table.etaSource} IS NULL OR ${table.etaSource} in ('provider','calculated')`,\n    ),\n    check(\n      'trip_locations_eta_time_check',\n      sql`${table.etaAt} IS NULL OR ${table.etaAt} >= ${table.recordedAt}`,\n    ),\n    check('trip_locations_received_check', sql`${table.receivedAt} >= ${table.recordedAt}`),\n    check(\n      'trip_locations_stale_after_check',\n      sql`${table.staleAfterSeconds} >= 60 AND ${table.staleAfterSeconds} <= 86400`,\n    ),\n    check(\n      'trip_locations_retention_check',\n      sql`${table.retentionUntil} > ${table.receivedAt}`,\n    ),",
)
replace_once(
    "packages/database/src/schema/trip-execution.ts",
    "    index('trip_locations_tenant_trip_recorded_idx').on(\n      table.tenantId,\n      table.tripId,\n      table.recordedAt,\n    ),",
    "    index('trip_locations_tenant_trip_recorded_idx').on(\n      table.tenantId,\n      table.tripId,\n      table.recordedAt,\n    ),\n    index('trip_locations_retention_idx').on(table.retentionUntil, table.id),",
)

# Provider contract and policy are vendor-neutral.
write(
    "apps/api/src/trips/trip-tracking-provider.port.ts",
    """export type TrackingEtaSource = 'provider' | 'calculated';

export interface TrackingProviderPosition {
  readonly providerEventId: string;
  readonly tripStopId?: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyM?: number | null;
  readonly speedKmh?: number | null;
  readonly headingDegrees?: number | null;
  readonly recordedAt: string;
  readonly etaAt?: string | null;
  readonly etaSource?: TrackingEtaSource | null;
  readonly metadata?: Record<string, unknown>;
}

export interface TrackingProviderAdapter {
  readonly key: string;
  normalizeEvent(input: unknown): Promise<TrackingProviderPosition> | TrackingProviderPosition;
}

export const TRACKING_PROVIDER_ADAPTERS = Symbol('TRACKING_PROVIDER_ADAPTERS');
""",
)
write(
    "apps/api/src/trips/trip-tracking.policy.ts",
    """export interface TrackingPolicy {
  readonly staleAfterSeconds: number;
  readonly retentionDays: number;
}

interface TrackingPolicyOverride {
  readonly staleAfterSeconds?: unknown;
  readonly retentionDays?: unknown;
}

const DEFAULT_STALE_AFTER_SECONDS = 900;
const DEFAULT_RETENTION_DAYS = 90;

export function resolveTrackingPolicy(
  provider: string | null,
  env: NodeJS.ProcessEnv = process.env,
): TrackingPolicy {
  const base: TrackingPolicy = {
    staleAfterSeconds: parseInteger(
      env.TRACKING_STALE_AFTER_SECONDS,
      'TRACKING_STALE_AFTER_SECONDS',
      DEFAULT_STALE_AFTER_SECONDS,
      60,
      86_400,
    ),
    retentionDays: parseInteger(
      env.TRACKING_RETENTION_DAYS,
      'TRACKING_RETENTION_DAYS',
      DEFAULT_RETENTION_DAYS,
      1,
      3_650,
    ),
  };

  if (!provider || !env.TRACKING_PROVIDER_POLICIES_JSON) return base;

  let parsed: unknown;
  try {
    parsed = JSON.parse(env.TRACKING_PROVIDER_POLICIES_JSON);
  } catch {
    throw new Error('TRACKING_PROVIDER_POLICIES_JSON must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('TRACKING_PROVIDER_POLICIES_JSON must be an object');
  }
  const override = (parsed as Record<string, TrackingPolicyOverride>)[provider];
  if (!override) return base;
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    throw new Error(`Tracking policy for provider ${provider} must be an object`);
  }

  return {
    staleAfterSeconds: parseInteger(
      override.staleAfterSeconds,
      `tracking policy ${provider}.staleAfterSeconds`,
      base.staleAfterSeconds,
      60,
      86_400,
    ),
    retentionDays: parseInteger(
      override.retentionDays,
      `tracking policy ${provider}.retentionDays`,
      base.retentionDays,
      1,
      3_650,
    ),
  };
}

function parseInteger(
  value: unknown,
  label: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}
""",
)
write(
    "apps/api/src/trips/trip-tracking.policy.spec.ts",
    """import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTrackingPolicy } from './trip-tracking.policy.js';

test('tracking policy uses bounded defaults', () => {
  assert.deepEqual(resolveTrackingPolicy(null, {}), {
    staleAfterSeconds: 900,
    retentionDays: 90,
  });
});

test('tracking policy applies provider override', () => {
  assert.deepEqual(
    resolveTrackingPolicy('provider-a', {
      TRACKING_STALE_AFTER_SECONDS: '1200',
      TRACKING_RETENTION_DAYS: '120',
      TRACKING_PROVIDER_POLICIES_JSON: JSON.stringify({
        'provider-a': { staleAfterSeconds: 300, retentionDays: 45 },
      }),
    }),
    { staleAfterSeconds: 300, retentionDays: 45 },
  );
});

test('tracking policy rejects unsafe bounds and invalid JSON', () => {
  assert.throws(
    () => resolveTrackingPolicy(null, { TRACKING_STALE_AFTER_SECONDS: '30' }),
    /between 60 and 86400/,
  );
  assert.throws(
    () => resolveTrackingPolicy('provider-a', { TRACKING_PROVIDER_POLICIES_JSON: '{' }),
    /valid JSON/,
  );
});
""",
)

# Validation: ETA pair and provider-specific normalized ingestion.
replace_once(
    "apps/api/src/trips/trip-execution.validation.ts",
    "import { requireUuid } from '../freight/transport-request.validation.js';",
    "import { requireUuid } from '../freight/transport-request.validation.js';\nimport type { TrackingEtaSource } from './trip-tracking-provider.port.js';",
)
replace_once(
    "apps/api/src/trips/trip-execution.validation.ts",
    "  readonly headingDegrees: number | null;\n  readonly recordedAt: string;",
    "  readonly headingDegrees: number | null;\n  readonly etaAt: string | null;\n  readonly etaSource: TrackingEtaSource | null;\n  readonly recordedAt: string;",
)
replace_once(
    "apps/api/src/trips/trip-execution.validation.ts",
    "const executionSources = new Set<TripExecutionSource>(['manual', 'mobile', 'gps', 'integration']);",
    "const executionSources = new Set<TripExecutionSource>(['manual', 'mobile', 'gps', 'integration']);\nconst trackingEtaSources = new Set<TrackingEtaSource>(['provider', 'calculated']);",
)
replace_once(
    "apps/api/src/trips/trip-execution.validation.ts",
    "export function parseTripLocation(input: unknown): TripLocationInput {\n  const body = requireRecord(input);\n  const source = requireEnum(body.source, 'source', executionSources);\n  const provider = optionalString(body.provider, 'provider', 80);\n  if (source === 'integration' && !provider) {\n    throw new BadRequestException('provider is required for integration locations');\n  }\n  return {",
    "export function parseTripLocation(input: unknown): TripLocationInput {\n  const body = requireRecord(input);\n  const source = requireEnum(body.source, 'source', executionSources);\n  const provider = optionalString(body.provider, 'provider', 80);\n  if (source === 'integration' && !provider) {\n    throw new BadRequestException('provider is required for integration locations');\n  }\n  const etaAt = optionalTimestamp(body.etaAt, 'etaAt');\n  const etaSource = optionalEnum(body.etaSource, 'etaSource', trackingEtaSources);\n  if ((etaAt === null) !== (etaSource === null)) {\n    throw new BadRequestException('etaAt and etaSource must be provided together');\n  }\n  return {",
)
replace_once(
    "apps/api/src/trips/trip-execution.validation.ts",
    "    headingDegrees: optionalNumber(body.headingDegrees, 'headingDegrees', 0, 359.999),\n    recordedAt: requireTimestamp(body.recordedAt, 'recordedAt'),",
    "    headingDegrees: optionalNumber(body.headingDegrees, 'headingDegrees', 0, 359.999),\n    etaAt,\n    etaSource,\n    recordedAt: requireTimestamp(body.recordedAt, 'recordedAt'),",
)
replace_once(
    "apps/api/src/trips/trip-execution.validation.ts",
    "export function parseTripChecklist(input: unknown): TripChecklistInput {",
    "export function parseTripProviderLocation(providerValue: unknown, input: unknown): TripLocationInput {\n  const provider = requireString(providerValue, 'provider', 80);\n  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(provider)) {\n    throw new BadRequestException('provider contains unsupported characters');\n  }\n  const body = requireRecord(input);\n  const providerEventId = requireString(body.providerEventId, 'providerEventId', 180);\n  return parseTripLocation({\n    ...body,\n    source: 'integration',\n    provider,\n    providerEventId,\n  });\n}\n\nexport function parseTripChecklist(input: unknown): TripChecklistInput {",
)
replace_once(
    "apps/api/src/trips/trip-execution.validation.ts",
    "function requireTimestamp(value: unknown, field: string): string {\n  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) {\n    throw new BadRequestException(`${field} must be a valid timestamp`);\n  }\n  return new Date(Date.parse(value)).toISOString();\n}\n\nfunction requireEnum",
    "function requireTimestamp(value: unknown, field: string): string {\n  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) {\n    throw new BadRequestException(`${field} must be a valid timestamp`);\n  }\n  return new Date(Date.parse(value)).toISOString();\n}\n\nfunction optionalTimestamp(value: unknown, field: string): string | null {\n  if (value === undefined || value === null || value === '') return null;\n  return requireTimestamp(value, field);\n}\n\nfunction optionalEnum<T extends string>(value: unknown, field: string, allowed: Set<T>): T | null {\n  if (value === undefined || value === null || value === '') return null;\n  return requireEnum(value, field, allowed);\n}\n\nfunction requireEnum",
)

# Service: provider-specific ingestion, policy persistence, retained history, and current snapshot.
replace_once(
    "apps/api/src/trips/trip-execution.service.ts",
    "  parseTripLocation,\n  parseTripProof,",
    "  parseTripLocation,\n  parseTripProviderLocation,\n  parseTripProof,",
)
replace_once(
    "apps/api/src/trips/trip-execution.service.ts",
    "} from './trip-execution.validation.js';",
    "  type TripLocationInput,\n} from './trip-execution.validation.js';\nimport { resolveTrackingPolicy } from './trip-tracking.policy.js';",
)
old_locations = """  listLocations(tripId: string) {
    return this.list(tripId, 'trip_locations', 'recorded_at,created_at');
  }

  async createLocation(tripId: string, input: unknown): Promise<Record<string, unknown>> {
    const location = parseTripLocation(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireOperationalTrip(client, tripId, false);
      if (location.tripStopId) await this.requireStop(client, trip.id, location.tripStopId, false);
      try {
        return await this.insertOne(
          client,
          `INSERT INTO trip_locations (
             tenant_id,trip_id,trip_stop_id,source,provider,provider_event_id,latitude,longitude,
             accuracy_m,speed_kmh,heading_degrees,recorded_at,metadata
           ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13::jsonb)
           RETURNING *`,
          [
            context.tenantId,
            trip.id,
            location.tripStopId,
            location.source,
            location.provider,
            location.providerEventId,
            location.latitude,
            location.longitude,
            location.accuracyM,
            location.speedKmh,
            location.headingDegrees,
            location.recordedAt,
            JSON.stringify(location.metadata),
          ],
        );
      } catch (error) {
        if (hasPgCode(error, '23505'))
          throw new ConflictException('Location event was already ingested');
        throw error;
      }
    });
  }
"""
new_locations = """  async listLocations(tripId: string): Promise<readonly Record<string, unknown>[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireTrip(client, tripId, false);
      const result = await client.query<Record<string, unknown>>(
        `SELECT * FROM trip_locations
          WHERE trip_id=$1::uuid AND retention_until > clock_timestamp()
          ORDER BY recorded_at,created_at`,
        [trip.id],
      );
      return result.rows;
    });
  }

  async createLocation(tripId: string, input: unknown): Promise<Record<string, unknown>> {
    const location = parseTripLocation(input);
    return this.createParsedLocation(tripId, location);
  }

  async ingestProviderLocation(
    tripId: string,
    provider: string,
    input: unknown,
  ): Promise<Record<string, unknown>> {
    const location = parseTripProviderLocation(provider, input);
    return this.createParsedLocation(tripId, location);
  }

  async getTrackingSnapshot(tripId: string): Promise<Record<string, unknown>> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireTrip(client, tripId, false);
      const result = await client.query<Record<string, unknown>>(
        `SELECT id::text AS id,source,provider,provider_event_id,latitude,longitude,
                accuracy_m,speed_kmh,heading_degrees,eta_at,eta_source,recorded_at,received_at,
                stale_after_seconds,retention_until,metadata,
                greatest(0,floor(extract(epoch FROM (clock_timestamp()-recorded_at))))::integer AS age_seconds,
                (clock_timestamp() > recorded_at + stale_after_seconds * interval '1 second') AS stale
           FROM trip_locations
          WHERE trip_id=$1::uuid AND retention_until > clock_timestamp()
          ORDER BY recorded_at DESC,created_at DESC
          LIMIT 1`,
        [trip.id],
      );
      const lastPosition = result.rows[0] ?? null;
      return {
        tripId: trip.id,
        tripStatus: trip.status,
        hasPosition: lastPosition !== null,
        lastPosition,
      };
    });
  }

  private async createParsedLocation(
    tripId: string,
    location: TripLocationInput,
  ): Promise<Record<string, unknown>> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireOperationalTrip(client, tripId, false);
      if (location.tripStopId) await this.requireStop(client, trip.id, location.tripStopId, false);
      const policy = resolveTrackingPolicy(location.provider);
      try {
        return await this.insertOne(
          client,
          `INSERT INTO trip_locations (
             tenant_id,trip_id,trip_stop_id,source,provider,provider_event_id,latitude,longitude,
             accuracy_m,speed_kmh,heading_degrees,eta_at,eta_source,recorded_at,
             stale_after_seconds,retention_until,metadata
           ) VALUES (
             $1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13,
             $14::timestamptz,$15::integer,clock_timestamp()+($16::integer * interval '1 day'),$17::jsonb
           )
           RETURNING *`,
          [
            context.tenantId,
            trip.id,
            location.tripStopId,
            location.source,
            location.provider,
            location.providerEventId,
            location.latitude,
            location.longitude,
            location.accuracyM,
            location.speedKmh,
            location.headingDegrees,
            location.etaAt,
            location.etaSource,
            location.recordedAt,
            policy.staleAfterSeconds,
            policy.retentionDays,
            JSON.stringify(location.metadata),
          ],
        );
      } catch (error) {
        if (hasPgCode(error, '23505'))
          throw new ConflictException('Location event was already ingested');
        throw error;
      }
    });
  }
"""
replace_once("apps/api/src/trips/trip-execution.service.ts", old_locations, new_locations)

# Controller routes.
replace_once(
    "apps/api/src/trips/trip-execution.controller.ts",
    "  @Post(':tripId/locations')\n  @TenantAuthorized('trips.write')\n  createLocation(@Param('tripId') tripId: string, @Body() body: unknown) {\n    return this.execution.createLocation(tripId, body);\n  }",
    "  @Post(':tripId/locations')\n  @TenantAuthorized('trips.write')\n  createLocation(@Param('tripId') tripId: string, @Body() body: unknown) {\n    return this.execution.createLocation(tripId, body);\n  }\n\n  @Get(':tripId/tracking')\n  getTrackingSnapshot(@Param('tripId') tripId: string) {\n    return this.execution.getTrackingSnapshot(tripId);\n  }\n\n  @Post(':tripId/tracking/providers/:provider/events')\n  @TenantAuthorized('trips.write')\n  ingestProviderLocation(\n    @Param('tripId') tripId: string,\n    @Param('provider') provider: string,\n    @Body() body: unknown,\n  ) {\n    return this.execution.ingestProviderLocation(tripId, provider, body);\n  }",
)

# Integration: existing provider ETA + fresh normalized provider event + snapshot + terminal readability.
replace_once(
    "apps/api/src/trips/trip-execution.integration.ts",
    "      headingDegrees: 90,\n      recordedAt: '2026-08-20T09:00:00Z',\n      metadata: { satelliteCount: 12 },",
    "      headingDegrees: 90,\n      etaAt: '2026-08-21T15:30:00Z',\n      etaSource: 'provider',\n      recordedAt: '2026-08-20T09:00:00Z',\n      metadata: { satelliteCount: 12 },",
)
replace_once(
    "apps/api/src/trips/trip-execution.integration.ts",
    "    await executionA.createEvent(TRIP_A, {\n      eventType: 'delay',",
    "    const freshRecordedAt = new Date().toISOString();\n    const freshEtaAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();\n    const normalizedPosition = await executionA.ingestProviderLocation(TRIP_A, 'provider-a', {\n      providerEventId: 'position-002',\n      latitude: -23.35,\n      longitude: -46.1,\n      speedKmh: 58,\n      recordedAt: freshRecordedAt,\n      etaAt: freshEtaAt,\n      etaSource: 'calculated',\n      metadata: { routeDistanceRemainingKm: 104 },\n    });\n    assert.equal(normalizedPosition.provider, 'provider-a');\n\n    const tracking = await executionA.getTrackingSnapshot(TRIP_A);\n    assert.equal(tracking.hasPosition, true);\n    const lastPosition = tracking.lastPosition as Record<string, unknown>;\n    assert.equal(lastPosition.provider_event_id, 'position-002');\n    assert.equal(lastPosition.eta_source, 'calculated');\n    assert.equal(lastPosition.stale, false);\n\n    await assert.rejects(\n      executionA.ingestProviderLocation(TRIP_A, 'provider-a', {\n        providerEventId: 'position-002',\n        latitude: -23.35,\n        longitude: -46.1,\n        recordedAt: freshRecordedAt,\n      }),\n      /already ingested/,\n    );\n\n    await executionA.createEvent(TRIP_A, {\n      eventType: 'delay',",
)
replace_once(
    "apps/api/src/trips/trip-execution.integration.ts",
    "    assert.equal((await executionA.listLocations(TRIP_A)).length, 1);",
    "    assert.equal((await executionA.listLocations(TRIP_A)).length, 2);",
)
replace_once(
    "apps/api/src/trips/trip-execution.integration.ts",
    "    assert.equal((await tripsB.list()).length, 0);\n    await assert.rejects(executionB.listEvents(TRIP_A), /Trip not found in current tenant/);",
    "    assert.equal((await tripsB.list()).length, 0);\n    await assert.rejects(executionB.listEvents(TRIP_A), /Trip not found in current tenant/);\n    await assert.rejects(\n      executionB.getTrackingSnapshot(TRIP_A),\n      /Trip not found in current tenant/,\n    );",
)
replace_once(
    "apps/api/src/trips/trip-execution.integration.ts",
    "    assert.equal(completed.status, 'completed');\n    await assert.rejects(",
    "    assert.equal(completed.status, 'completed');\n    const completedTracking = await executionA.getTrackingSnapshot(TRIP_A);\n    assert.equal(completedTracking.hasPosition, true);\n    assert.equal(completedTracking.tripStatus, 'completed');\n    await assert.rejects(",
)

# Docs for the residual feature.
write(
    "docs/data/nex-45-tracking-eta.md",
    """# NEX-45 — External Tracking and ETA

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
""",
)

# Format source before Drizzle generation.
subprocess.run(["pnpm", "exec", "prettier", "--write", "packages/database/src/schema/trip-execution.ts", "apps/api/src/trips/trip-execution.validation.ts", "apps/api/src/trips/trip-execution.service.ts", "apps/api/src/trips/trip-execution.controller.ts", "apps/api/src/trips/trip-execution.integration.ts", "apps/api/src/trips/trip-tracking-provider.port.ts", "apps/api/src/trips/trip-tracking.policy.ts", "apps/api/src/trips/trip-tracking.policy.spec.ts", "docs/data/nex-45-tracking-eta.md"], check=True)

before = {p.name for p in (ROOT / "packages/database/migrations").glob("*.sql")}
subprocess.run(["pnpm", "--filter", "@nexora/database", "db:generate"], check=True)
after = {p.name for p in (ROOT / "packages/database/migrations").glob("*.sql")}
created = sorted(after - before)
if len(created) != 1:
    raise RuntimeError(f"Expected exactly one generated migration, found {created}")
migration = ROOT / "packages/database/migrations" / created[0]

# Advanced retention SQL is versioned in the same generated migration.
with migration.open("a") as handle:
    handle.write("""
--> statement-breakpoint
CREATE FUNCTION \"nexora_purge_expired_trip_locations\"(p_batch_size integer DEFAULT 1000)
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
REVOKE ALL ON FUNCTION \"nexora_purge_expired_trip_locations\"(integer) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION \"nexora_purge_expired_trip_locations\"(integer) TO nexora_worker;
""")

subprocess.run(["pnpm", "--filter", "@nexora/database", "db:check"], check=True)
subprocess.run(["pnpm", "validate"], check=True)
print(f"NEX45_MIGRATION={created[0]}")
