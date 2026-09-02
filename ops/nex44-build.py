from pathlib import Path


def patch(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1))


# Capacity reservation lifecycle: active -> released after successful trip execution.
path = "packages/database/src/schema/capacity-reservation.ts"
patch(
    path,
    "export const capacityReservationStatusEnum = pgEnum('capacity_reservation_status', [\n  'active',\n  'cancelled',\n]);",
    "export const capacityReservationStatusEnum = pgEnum('capacity_reservation_status', [\n  'active',\n  'cancelled',\n  'released',\n]);",
)
patch(
    path,
    "export const capacityReservationEventTypeEnum = pgEnum('capacity_reservation_event_type', [\n  'approved',\n  'cancelled',\n]);",
    "export const capacityReservationEventTypeEnum = pgEnum('capacity_reservation_event_type', [\n  'approved',\n  'cancelled',\n  'released',\n]);",
)
patch(
    path,
    "    cancelReason: varchar('cancel_reason', { length: 1000 }),\n    createdAt:",
    "    cancelReason: varchar('cancel_reason', { length: 1000 }),\n    releasedByUserId: uuid('released_by_user_id').references(() => users.id, {\n      onDelete: 'restrict',\n    }),\n    releasedAt: timestamp('released_at', { withTimezone: true }),\n    releaseReason: varchar('release_reason', { length: 1000 }),\n    createdAt:",
)
patch(
    path,
    """      sql`(
        ${table.status} = 'active'
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
      ) OR (
        ${table.status} = 'cancelled'
        AND ${table.cancelledByUserId} IS NOT NULL
        AND ${table.cancelledAt} IS NOT NULL
        AND length(trim(coalesce(${table.cancelReason}, ''))) > 0
      )`,""",
    """      sql`(
        ${table.status} = 'active'
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
        AND ${table.releasedByUserId} IS NULL
        AND ${table.releasedAt} IS NULL
        AND ${table.releaseReason} IS NULL
      ) OR (
        ${table.status} = 'cancelled'
        AND ${table.cancelledByUserId} IS NOT NULL
        AND ${table.cancelledAt} IS NOT NULL
        AND length(trim(coalesce(${table.cancelReason}, ''))) > 0
        AND ${table.releasedByUserId} IS NULL
        AND ${table.releasedAt} IS NULL
        AND ${table.releaseReason} IS NULL
      ) OR (
        ${table.status} = 'released'
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
        AND ${table.releasedByUserId} IS NOT NULL
        AND ${table.releasedAt} IS NOT NULL
        AND length(trim(coalesce(${table.releaseReason}, ''))) > 0
      )`,""",
)
patch(
    path,
    "      sql`${table.type} <> 'cancelled' OR length(trim(coalesce(${table.reason}, ''))) > 0`,",
    "      sql`${table.type} = 'approved' OR length(trim(coalesce(${table.reason}, ''))) > 0`,",
)

# Transport contract lifecycle: confirmed -> fulfilled after successful trip execution.
path = "packages/database/src/schema/transport-contract.ts"
patch(
    path,
    "export const transportContractStatusEnum = pgEnum('transport_contract_status', [\n  'confirmed',\n  'refused',\n  'cancelled',\n]);",
    "export const transportContractStatusEnum = pgEnum('transport_contract_status', [\n  'confirmed',\n  'refused',\n  'cancelled',\n  'fulfilled',\n]);",
)
patch(
    path,
    "export const transportContractEventTypeEnum = pgEnum('transport_contract_event_type', [\n  'confirmed',\n  'refused',\n  'cancelled',\n]);",
    "export const transportContractEventTypeEnum = pgEnum('transport_contract_event_type', [\n  'confirmed',\n  'refused',\n  'cancelled',\n  'fulfilled',\n]);",
)
patch(
    path,
    "    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),\n    refusedByUserId:",
    "    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),\n    fulfilledByUserId: uuid('fulfilled_by_user_id').references(() => users.id, {\n      onDelete: 'restrict',\n    }),\n    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),\n    refusedByUserId:",
)
patch(
    path,
    """      sql`(
        ${table.status} = 'confirmed'
        AND ${table.confirmedByUserId} IS NOT NULL
        AND ${table.confirmedAt} IS NOT NULL
        AND ${table.refusedByUserId} IS NULL
        AND ${table.refusedAt} IS NULL
        AND ${table.refusalReason} IS NULL
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
      ) OR (
        ${table.status} = 'refused'
        AND ${table.confirmedByUserId} IS NULL
        AND ${table.confirmedAt} IS NULL
        AND ${table.refusedByUserId} IS NOT NULL
        AND ${table.refusedAt} IS NOT NULL
        AND length(trim(coalesce(${table.refusalReason}, ''))) > 0
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
      ) OR (
        ${table.status} = 'cancelled'
        AND ${table.confirmedByUserId} IS NOT NULL
        AND ${table.confirmedAt} IS NOT NULL
        AND ${table.refusedByUserId} IS NULL
        AND ${table.refusedAt} IS NULL
        AND ${table.refusalReason} IS NULL
        AND ${table.cancelledByUserId} IS NOT NULL
        AND ${table.cancelledAt} IS NOT NULL
        AND length(trim(coalesce(${table.cancelReason}, ''))) > 0
      )`,""",
    """      sql`(
        ${table.status} = 'confirmed'
        AND ${table.confirmedByUserId} IS NOT NULL
        AND ${table.confirmedAt} IS NOT NULL
        AND ${table.fulfilledByUserId} IS NULL
        AND ${table.fulfilledAt} IS NULL
        AND ${table.refusedByUserId} IS NULL
        AND ${table.refusedAt} IS NULL
        AND ${table.refusalReason} IS NULL
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
      ) OR (
        ${table.status} = 'fulfilled'
        AND ${table.confirmedByUserId} IS NOT NULL
        AND ${table.confirmedAt} IS NOT NULL
        AND ${table.fulfilledByUserId} IS NOT NULL
        AND ${table.fulfilledAt} IS NOT NULL
        AND ${table.refusedByUserId} IS NULL
        AND ${table.refusedAt} IS NULL
        AND ${table.refusalReason} IS NULL
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
      ) OR (
        ${table.status} = 'refused'
        AND ${table.confirmedByUserId} IS NULL
        AND ${table.confirmedAt} IS NULL
        AND ${table.fulfilledByUserId} IS NULL
        AND ${table.fulfilledAt} IS NULL
        AND ${table.refusedByUserId} IS NOT NULL
        AND ${table.refusedAt} IS NOT NULL
        AND length(trim(coalesce(${table.refusalReason}, ''))) > 0
        AND ${table.cancelledByUserId} IS NULL
        AND ${table.cancelledAt} IS NULL
        AND ${table.cancelReason} IS NULL
      ) OR (
        ${table.status} = 'cancelled'
        AND ${table.confirmedByUserId} IS NOT NULL
        AND ${table.confirmedAt} IS NOT NULL
        AND ${table.fulfilledByUserId} IS NULL
        AND ${table.fulfilledAt} IS NULL
        AND ${table.refusedByUserId} IS NULL
        AND ${table.refusedAt} IS NULL
        AND ${table.refusalReason} IS NULL
        AND ${table.cancelledByUserId} IS NOT NULL
        AND ${table.cancelledAt} IS NOT NULL
        AND length(trim(coalesce(${table.cancelReason}, ''))) > 0
      )`,""",
)

# Harden the existing trip status lifecycle instead of creating a second completion mechanism.
path = "apps/api/src/trips/trips.service.ts"
patch(
    path,
    "      if (transition.status === 'ready') {\n        await this.requireReadyPrerequisites(client, current.id);\n      }",
    "      if (transition.status === 'ready') {\n        await this.requireReadyPrerequisites(client, current.id);\n      }\n      if (transition.status === 'completed') {\n        await this.requireCompletionPrerequisites(client, current.id);\n      }",
)
patch(
    path,
    "                actual_end_at=CASE WHEN $1::trip_status='completed' THEN coalesce(actual_end_at,now()) ELSE actual_end_at END,",
    "                actual_end_at=CASE WHEN $1::trip_status IN ('completed','cancelled') AND actual_start_at IS NOT NULL THEN coalesce(actual_end_at,now()) ELSE actual_end_at END,",
)
patch(
    path,
    """      await client.query(
        `INSERT INTO trip_status_history (
           tenant_id,trip_id,from_status,to_status,actor_user_id,reason
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6)`,
        [
          context.tenantId,
          current.id,
          current.status,
          transition.status,
          context.userId,
          transition.reason,
        ],
      );
      return mapTrip(await this.requireTrip(client, current.id, false));""",
    """      await client.query(
        `INSERT INTO trip_status_history (
           tenant_id,trip_id,from_status,to_status,actor_user_id,reason
         ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6)`,
        [
          context.tenantId,
          current.id,
          current.status,
          transition.status,
          context.userId,
          transition.reason,
        ],
      );
      if (transition.status === 'completed' || transition.status === 'cancelled') {
        await this.finalizeTerminalTrip(
          client,
          current.id,
          transition.status,
          transition.reason,
          context.userId,
        );
      }
      return mapTrip(await this.requireTrip(client, current.id, false));""",
)

helper = r'''  private async requireCompletionPrerequisites(
    client: TenantQueryClient,
    tripId: string,
  ): Promise<void> {
    const result = await client.query<{ blocked_stops: number; blocked_checklists: number }>(
      `SELECT
         (SELECT count(*)::int
            FROM trip_stops
           WHERE trip_id=$1::uuid
             AND (
               (type IN ('pickup','delivery') AND status <> 'departed')
               OR (type='support' AND status NOT IN ('departed','skipped','cancelled'))
             )) AS blocked_stops,
         (SELECT count(*)::int
            FROM trip_checklists
           WHERE trip_id=$1::uuid
             AND required=true
             AND status NOT IN ('completed','waived')) AS blocked_checklists`,
      [tripId],
    );
    const readiness = result.rows[0];
    if (!readiness) throw new ConflictException('Trip completion prerequisites could not be evaluated');
    if (readiness.blocked_stops > 0) {
      throw new ConflictException('Trip cannot be completed while required stops are pending');
    }
    if (readiness.blocked_checklists > 0) {
      throw new ConflictException(
        'Trip cannot be completed while required checklist items are pending or failed',
      );
    }
  }

  private async finalizeTerminalTrip(
    client: TenantQueryClient,
    tripId: string,
    status: 'completed' | 'cancelled',
    reason: string | null,
    userId: string,
  ): Promise<void> {
    const terminal = await client.query<{ terminal_at: Date }>(
      `SELECT coalesce(actual_end_at,now()) AS terminal_at FROM trips WHERE id=$1::uuid`,
      [tripId],
    );
    const terminalAt = terminal.rows[0]?.terminal_at;
    if (!terminalAt) throw new ConflictException('Trip terminal timestamp could not be resolved');
    const terminalIso = terminalAt.toISOString();

    await client.query(
      `UPDATE trip_drivers
          SET ends_at=greatest(starts_at,$2::timestamptz),updated_by_user_id=$3::uuid,updated_at=now()
        WHERE trip_id=$1::uuid AND ends_at IS NULL`,
      [tripId, terminalIso, userId],
    );
    await client.query(
      `UPDATE trip_assets
          SET ends_at=greatest(starts_at,$2::timestamptz),updated_by_user_id=$3::uuid,updated_at=now()
        WHERE trip_id=$1::uuid AND ends_at IS NULL`,
      [tripId, terminalIso, userId],
    );

    const contracts = await client.query<{ id: string; reservation_id: string }>(
      `SELECT c.id::text AS id,c.reservation_id::text AS reservation_id
         FROM trip_transport_requests link
         JOIN transport_contracts c
           ON c.tenant_id=link.tenant_id
          AND c.transport_request_id=link.transport_request_id
          AND c.id=link.transport_contract_id
        WHERE link.trip_id=$1::uuid
          AND link.removed_at IS NULL
          AND c.status='confirmed'
        ORDER BY c.id
        FOR UPDATE OF c`,
      [tripId],
    );

    if (contracts.rows.length > 0) {
      const contractIds = contracts.rows.map((row) => row.id);
      const reservationIds = contracts.rows.map((row) => row.reservation_id);
      if (status === 'completed') {
        const releaseReason = `Released after trip ${tripId} completed`;
        await client.query(
          `UPDATE transport_contracts
              SET status='fulfilled',fulfilled_by_user_id=$2::uuid,fulfilled_at=$3::timestamptz,updated_at=now()
            WHERE id=ANY($1::uuid[]) AND status='confirmed'`,
          [contractIds, userId, terminalIso],
        );
        await client.query(
          `INSERT INTO transport_contract_events (tenant_id,contract_id,type,actor_user_id,reason)
           SELECT current_setting('app.tenant_id')::uuid,id,'fulfilled',$2::uuid,$3
             FROM unnest($1::uuid[]) AS id`,
          [contractIds, userId, releaseReason],
        );
        await client.query(
          `UPDATE capacity_reservations
              SET status='released',released_by_user_id=$2::uuid,released_at=$3::timestamptz,
                  release_reason=$4,updated_at=now()
            WHERE id=ANY($1::uuid[]) AND status='active'`,
          [reservationIds, userId, terminalIso, releaseReason],
        );
        await client.query(
          `INSERT INTO capacity_reservation_events (tenant_id,reservation_id,type,actor_user_id,reason)
           SELECT current_setting('app.tenant_id')::uuid,id,'released',$2::uuid,$3
             FROM unnest($1::uuid[]) AS id`,
          [reservationIds, userId, releaseReason],
        );
      } else {
        const cancellationReason = reason ?? `Trip ${tripId} cancelled`;
        await client.query(
          `UPDATE transport_contracts
              SET status='cancelled',cancelled_by_user_id=$2::uuid,cancelled_at=$3::timestamptz,
                  cancel_reason=$4,updated_at=now()
            WHERE id=ANY($1::uuid[]) AND status='confirmed'`,
          [contractIds, userId, terminalIso, cancellationReason],
        );
        await client.query(
          `INSERT INTO transport_contract_events (tenant_id,contract_id,type,actor_user_id,reason)
           SELECT current_setting('app.tenant_id')::uuid,id,'cancelled',$2::uuid,$3
             FROM unnest($1::uuid[]) AS id`,
          [contractIds, userId, cancellationReason],
        );
        await client.query(
          `UPDATE capacity_reservations
              SET status='cancelled',cancelled_by_user_id=$2::uuid,cancelled_at=$3::timestamptz,
                  cancel_reason=$4,updated_at=now()
            WHERE id=ANY($1::uuid[]) AND status='active'`,
          [reservationIds, userId, terminalIso, cancellationReason],
        );
        await client.query(
          `INSERT INTO capacity_reservation_events (tenant_id,reservation_id,type,actor_user_id,reason)
           SELECT current_setting('app.tenant_id')::uuid,id,'cancelled',$2::uuid,$3
             FROM unnest($1::uuid[]) AS id`,
          [reservationIds, userId, cancellationReason],
        );
      }
    }

    await client.query(
      `UPDATE driver_availability availability
          SET status='available',available_from=$2::timestamptz,available_until=NULL,
              updated_by_user_id=$3::uuid,updated_at=now()
        WHERE availability.status='assigned'
          AND availability.driver_id IN (SELECT driver_id FROM trip_drivers WHERE trip_id=$1::uuid)
          AND NOT EXISTS (
            SELECT 1 FROM capacity_reservations reservation
             WHERE reservation.driver_id=availability.driver_id AND reservation.status='active'
          )`,
      [tripId, terminalIso, userId],
    );
    await client.query(
      `UPDATE capacity_asset_availability availability
          SET status='available',available_from=$2::timestamptz,available_until=NULL,
              updated_by_user_id=$3::uuid,updated_at=now()
        WHERE availability.status='assigned'
          AND availability.asset_id IN (SELECT asset_id FROM trip_assets WHERE trip_id=$1::uuid)
          AND NOT EXISTS (
            SELECT 1 FROM capacity_reservations reservation
             WHERE reservation.vehicle_id=availability.asset_id AND reservation.status='active'
          )`,
      [tripId, terminalIso, userId],
    );
  }

'''
file = Path(path)
text = file.read_text()
marker = "  private async listSubresource(\n"
if marker not in text:
    raise SystemExit("TripsService helper marker not found")
file.write_text(text.replace(marker, helper + marker, 1))

# Keep reservation history API accurate after a release.
path = "apps/api/src/negotiation/capacity-reservation.service.ts"
file = Path(path)
text = file.read_text()
text = text.replace("'active' | 'cancelled'", "'active' | 'cancelled' | 'released'")
text = text.replace("'approved' | 'cancelled'", "'approved' | 'cancelled' | 'released'")
text = text.replace(
    "  readonly cancel_reason: string | null;\n  readonly created_at:",
    "  readonly cancel_reason: string | null;\n  readonly released_by_user_id: string | null;\n  readonly released_by_name: string | null;\n  readonly released_at: Date | null;\n  readonly release_reason: string | null;\n  readonly created_at:",
    1,
)
text = text.replace(
    "  readonly cancelReason: string | null;\n  readonly createdAt:",
    "  readonly cancelReason: string | null;\n  readonly releasedBy: { readonly userId: string; readonly name: string } | null;\n  readonly releasedAt: string | null;\n  readonly releaseReason: string | null;\n  readonly createdAt:",
    1,
)
text = text.replace(
    "              r.cancel_reason,\n              r.created_at,",
    "              r.cancel_reason,\n              r.released_by_user_id::text AS released_by_user_id,\n              releaser.display_name AS released_by_name,\n              r.released_at,\n              r.release_reason,\n              r.created_at,",
    1,
)
text = text.replace(
    "         LEFT JOIN users canceller ON canceller.id=r.cancelled_by_user_id\n        WHERE",
    "         LEFT JOIN users canceller ON canceller.id=r.cancelled_by_user_id\n         LEFT JOIN users releaser ON releaser.id=r.released_by_user_id\n        WHERE",
    1,
)
text = text.replace(
    "    cancelReason: row.cancel_reason,\n    createdAt:",
    "    cancelReason: row.cancel_reason,\n    releasedBy:\n      row.released_by_user_id && row.released_by_name\n        ? { userId: row.released_by_user_id, name: row.released_by_name }\n        : null,\n    releasedAt: row.released_at?.toISOString() ?? null,\n    releaseReason: row.release_reason,\n    createdAt:",
    1,
)
file.write_text(text)

# Keep contract history API accurate after fulfillment.
path = "apps/api/src/negotiation/transport-contract.service.ts"
file = Path(path)
text = file.read_text()
text = text.replace(
    "'confirmed' | 'refused' | 'cancelled'",
    "'confirmed' | 'refused' | 'cancelled' | 'fulfilled'",
)
text = text.replace(
    "  readonly confirmed_at: Date | null;\n  readonly refused_by_user_id:",
    "  readonly confirmed_at: Date | null;\n  readonly fulfilled_by_user_id: string | null;\n  readonly fulfilled_at: Date | null;\n  readonly refused_by_user_id:",
    1,
)
text = text.replace(
    "  readonly confirmedAt: string | null;\n  readonly refusedByUserId:",
    "  readonly confirmedAt: string | null;\n  readonly fulfilledByUserId: string | null;\n  readonly fulfilledAt: string | null;\n  readonly refusedByUserId:",
    1,
)
text = text.replace(
    "              confirmed_at,\n              refused_by_user_id::text AS refused_by_user_id,",
    "              confirmed_at,\n              fulfilled_by_user_id::text AS fulfilled_by_user_id,\n              fulfilled_at,\n              refused_by_user_id::text AS refused_by_user_id,",
    1,
)
text = text.replace(
    "      confirmedAt: contract.confirmed_at?.toISOString() ?? null,\n      refusedByUserId:",
    "      confirmedAt: contract.confirmed_at?.toISOString() ?? null,\n      fulfilledByUserId: contract.fulfilled_by_user_id,\n      fulfilledAt: contract.fulfilled_at?.toISOString() ?? null,\n      refusedByUserId:",
    1,
)
file.write_text(text)
