import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';
import { CapacityMatchingService } from '../matching/capacity-matching.service.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import { parseCapacityReservationCancel } from './capacity-reservation.validation.js';

interface ProposalCandidateRow {
  readonly id: string;
  readonly transport_request_id: string;
  readonly capacity_assignment_id: string;
  readonly carrier_party_id: string;
  readonly expires_at: Date | null;
  readonly request_status: string;
  readonly current_status: string;
}

interface FinalStateRow extends ProposalCandidateRow {
  readonly assignment_status: string;
  readonly driver_id: string;
  readonly driver_registration_status: string;
  readonly driver_operational_status: string;
  readonly vehicle_id: string;
  readonly vehicle_kind: string;
  readonly vehicle_status: string;
  readonly assignment_carrier_party_id: string;
}

interface ReservationIdentityRow {
  readonly id: string;
  readonly status: 'active' | 'cancelled' | 'released';
}

interface ReservationRow {
  readonly id: string;
  readonly transport_request_id: string;
  readonly proposal_id: string;
  readonly capacity_assignment_id: string;
  readonly driver_id: string;
  readonly driver_name: string;
  readonly vehicle_id: string;
  readonly vehicle_identifier: string;
  readonly vehicle_plate: string | null;
  readonly carrier_party_id: string;
  readonly carrier_name: string;
  readonly status: 'active' | 'cancelled' | 'released';
  readonly approved_by_user_id: string;
  readonly approved_by_name: string;
  readonly approved_at: Date;
  readonly cancelled_by_user_id: string | null;
  readonly cancelled_by_name: string | null;
  readonly cancelled_at: Date | null;
  readonly cancel_reason: string | null;
  readonly released_by_user_id: string | null;
  readonly released_by_name: string | null;
  readonly released_at: Date | null;
  readonly release_reason: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface ReservationEventRow {
  readonly id: string;
  readonly reservation_id: string;
  readonly type: 'approved' | 'cancelled' | 'released';
  readonly actor_user_id: string;
  readonly actor_name: string;
  readonly reason: string | null;
  readonly created_at: Date;
}

export interface CapacityReservationEvent {
  readonly id: string;
  readonly type: 'approved' | 'cancelled' | 'released';
  readonly actorUserId: string;
  readonly actorName: string;
  readonly reason: string | null;
  readonly createdAt: string;
}

export interface CapacityReservation {
  readonly id: string;
  readonly transportRequestId: string;
  readonly proposalId: string;
  readonly capacityAssignmentId: string;
  readonly driver: {
    readonly id: string;
    readonly name: string;
  };
  readonly vehicle: {
    readonly id: string;
    readonly identifier: string;
    readonly plate: string | null;
  };
  readonly carrier: {
    readonly id: string;
    readonly name: string;
  };
  readonly status: 'active' | 'cancelled' | 'released';
  readonly approvedBy: {
    readonly userId: string;
    readonly name: string;
  };
  readonly approvedAt: string;
  readonly cancelledBy: {
    readonly userId: string;
    readonly name: string;
  } | null;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly releasedBy: { readonly userId: string; readonly name: string } | null;
  readonly releasedAt: string | null;
  readonly releaseReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly events: readonly CapacityReservationEvent[];
}

@Injectable()
export class CapacityReservationService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
    private readonly matching: CapacityMatchingService,
  ) {}

  async list(requestId: string): Promise<readonly CapacityReservation[]> {
    const transportRequestId = requireUuid(requestId, 'requestId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireRequest(client, transportRequestId);
      return this.loadHistory(client, transportRequestId);
    });
  }

  async approve(proposalId: string): Promise<CapacityReservation> {
    const id = requireUuid(proposalId, 'proposalId');
    const context = this.tenantContext.require();

    const snapshot = await this.database.withTenantContext(context, async (client) =>
      this.requireProposalCandidate(client, id),
    );
    this.validateReservableProposal(snapshot);

    const matching = await this.matching.search(snapshot.transport_request_id);
    const candidate = matching.compatible.find(
      (item) => item.assignmentId === snapshot.capacity_assignment_id,
    );
    if (!candidate || candidate.carrier.id !== snapshot.carrier_party_id) {
      const incompatible = matching.incompatible.find(
        (item) => item.assignmentId === snapshot.capacity_assignment_id,
      );
      throw new ConflictException({
        message: 'Winning proposal capacity is no longer compatible with the transport request',
        reasons: incompatible?.reasons ?? [],
      });
    }

    return this.database.withTenantContext(context, async (client) => {
      await this.lockReservationKeys(
        client,
        context.tenantId,
        snapshot.transport_request_id,
        snapshot.capacity_assignment_id,
      );

      const finalState = await this.requireFinalState(client, id);
      this.validateFinalState(finalState);

      if (
        finalState.driver_id !== candidate.driver.id ||
        finalState.vehicle_id !== candidate.vehicle.id ||
        finalState.assignment_carrier_party_id !== candidate.carrier.id
      ) {
        throw new ConflictException('Capacity composition changed after compatibility validation');
      }

      let reservationId: string;
      try {
        const result = await client.query<{ id: string }>(
          `INSERT INTO capacity_reservations (
             tenant_id,transport_request_id,proposal_id,capacity_assignment_id,
             driver_id,vehicle_id,carrier_party_id,approved_by_user_id
           ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8::uuid)
           RETURNING id::text AS id`,
          [
            context.tenantId,
            finalState.transport_request_id,
            finalState.id,
            finalState.capacity_assignment_id,
            finalState.driver_id,
            finalState.vehicle_id,
            finalState.carrier_party_id,
            context.userId,
          ],
        );
        reservationId = result.rows[0]?.id ?? '';
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException(reservationConflictMessage(error));
        }
        throw error;
      }

      if (!reservationId) {
        throw new ConflictException('Capacity reservation could not be created');
      }

      await this.insertEvent(
        client,
        context.tenantId,
        reservationId,
        'approved',
        context.userId,
        null,
      );
      return this.loadOne(client, reservationId);
    });
  }

  async cancel(reservationId: string, input: unknown): Promise<CapacityReservation> {
    const id = requireUuid(reservationId, 'reservationId');
    const cancellation = parseCapacityReservationCancel(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.lockReservation(client, context.tenantId, id);
      const reservation = await this.requireReservationIdentity(client, id);
      if (reservation.status !== 'active') {
        throw new ConflictException('Capacity reservation is already cancelled');
      }

      const result = await client.query<{ id: string }>(
        `UPDATE capacity_reservations
            SET status='cancelled',
                cancelled_by_user_id=$2::uuid,
                cancelled_at=now(),
                cancel_reason=$3,
                updated_at=now()
          WHERE id=$1::uuid AND status='active'
          RETURNING id::text AS id`,
        [id, context.userId, cancellation.reason],
      );
      if (!result.rows[0]) {
        throw new ConflictException('Capacity reservation changed concurrently');
      }

      await this.insertEvent(
        client,
        context.tenantId,
        id,
        'cancelled',
        context.userId,
        cancellation.reason,
      );
      return this.loadOne(client, id);
    });
  }

  private async requireRequest(client: TenantQueryClient, requestId: string): Promise<void> {
    const result = await client.query<{ id: string }>(
      'SELECT id::text AS id FROM transport_requests WHERE id=$1::uuid',
      [requestId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Transport request not found in current tenant');
    }
  }

  private async requireProposalCandidate(
    client: TenantQueryClient,
    proposalId: string,
  ): Promise<ProposalCandidateRow> {
    const result = await client.query<ProposalCandidateRow>(
      `SELECT p.id::text AS id,
              p.transport_request_id::text AS transport_request_id,
              p.capacity_assignment_id::text AS capacity_assignment_id,
              p.carrier_party_id::text AS carrier_party_id,
              p.expires_at,
              tr.status::text AS request_status,
              current_event.status::text AS current_status
         FROM freight_proposals p
         JOIN transport_requests tr
           ON tr.tenant_id=p.tenant_id AND tr.id=p.transport_request_id
         JOIN LATERAL (
           SELECT status
             FROM freight_proposal_events
            WHERE tenant_id=p.tenant_id AND proposal_id=p.id
            ORDER BY created_at DESC,id DESC
            LIMIT 1
         ) current_event ON true
        WHERE p.id=$1::uuid`,
      [proposalId],
    );
    const proposal = result.rows[0];
    if (!proposal) {
      throw new NotFoundException('Freight proposal not found in current tenant');
    }
    return proposal;
  }

  private validateReservableProposal(proposal: ProposalCandidateRow): void {
    if (proposal.current_status !== 'accepted') {
      throw new ConflictException('Only an accepted freight proposal can reserve capacity');
    }
    if (
      proposal.request_status !== 'ready_for_quote' &&
      proposal.request_status !== 'in_negotiation'
    ) {
      throw new ConflictException(
        `Capacity cannot be reserved while transport request status is ${proposal.request_status}`,
      );
    }
    if (proposal.expires_at !== null && proposal.expires_at.valueOf() <= Date.now()) {
      throw new ConflictException(
        'Accepted freight proposal has expired before capacity reservation',
      );
    }
  }

  private async requireFinalState(
    client: TenantQueryClient,
    proposalId: string,
  ): Promise<FinalStateRow> {
    const result = await client.query<FinalStateRow>(
      `SELECT p.id::text AS id,
              p.transport_request_id::text AS transport_request_id,
              p.capacity_assignment_id::text AS capacity_assignment_id,
              p.carrier_party_id::text AS carrier_party_id,
              p.expires_at,
              tr.status::text AS request_status,
              current_event.status::text AS current_status,
              a.status::text AS assignment_status,
              a.driver_id::text AS driver_id,
              d.registration_status::text AS driver_registration_status,
              d.operational_status::text AS driver_operational_status,
              a.vehicle_id::text AS vehicle_id,
              v.asset_kind::text AS vehicle_kind,
              v.status::text AS vehicle_status,
              a.carrier_party_id::text AS assignment_carrier_party_id
         FROM freight_proposals p
         JOIN transport_requests tr
           ON tr.tenant_id=p.tenant_id AND tr.id=p.transport_request_id
         JOIN capacity_assignments a
           ON a.tenant_id=p.tenant_id AND a.id=p.capacity_assignment_id
         JOIN drivers d ON d.tenant_id=a.tenant_id AND d.id=a.driver_id
         JOIN capacity_assets v ON v.tenant_id=a.tenant_id AND v.id=a.vehicle_id
         JOIN LATERAL (
           SELECT status
             FROM freight_proposal_events
            WHERE tenant_id=p.tenant_id AND proposal_id=p.id
            ORDER BY created_at DESC,id DESC
            LIMIT 1
         ) current_event ON true
        WHERE p.id=$1::uuid`,
      [proposalId],
    );
    const state = result.rows[0];
    if (!state) {
      throw new NotFoundException('Winning proposal composition not found in current tenant');
    }
    return state;
  }

  private validateFinalState(state: FinalStateRow): void {
    this.validateReservableProposal(state);
    if (state.assignment_status !== 'active') {
      throw new ConflictException('Capacity assignment is no longer active');
    }
    if (state.driver_registration_status !== 'qualified') {
      throw new ConflictException('Selected driver is no longer qualified');
    }
    if (state.driver_operational_status !== 'active') {
      throw new ConflictException('Selected driver is no longer operationally active');
    }
    if (state.vehicle_kind !== 'vehicle') {
      throw new ConflictException('Selected capacity asset is not a vehicle');
    }
    if (state.vehicle_status !== 'active') {
      throw new ConflictException('Selected vehicle is no longer active');
    }
    if (state.assignment_carrier_party_id !== state.carrier_party_id) {
      throw new ConflictException(
        'Selected assignment carrier no longer matches the winning proposal',
      );
    }
  }

  private async requireReservationIdentity(
    client: TenantQueryClient,
    reservationId: string,
  ): Promise<ReservationIdentityRow> {
    const result = await client.query<ReservationIdentityRow>(
      `SELECT id::text AS id,status::text AS status
         FROM capacity_reservations
        WHERE id=$1::uuid`,
      [reservationId],
    );
    const reservation = result.rows[0];
    if (!reservation) {
      throw new NotFoundException('Capacity reservation not found in current tenant');
    }
    return reservation;
  }

  private async lockReservationKeys(
    client: TenantQueryClient,
    tenantId: string,
    requestId: string,
    assignmentId: string,
  ): Promise<void> {
    for (const key of [
      `${tenantId}:${requestId}:capacity-reservation-request`,
      `${tenantId}:${assignmentId}:capacity-reservation-assignment`,
    ].sort()) {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    }
  }

  private async lockReservation(
    client: TenantQueryClient,
    tenantId: string,
    reservationId: string,
  ): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${tenantId}:${reservationId}:capacity-reservation-state`,
    ]);
  }

  private async insertEvent(
    client: TenantQueryClient,
    tenantId: string,
    reservationId: string,
    type: 'approved' | 'cancelled' | 'released',
    actorUserId: string,
    reason: string | null,
  ): Promise<void> {
    await client.query(
      `INSERT INTO capacity_reservation_events (tenant_id,reservation_id,type,actor_user_id,reason)
       VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5)`,
      [tenantId, reservationId, type, actorUserId, reason],
    );
  }

  private async loadHistory(
    client: TenantQueryClient,
    requestId: string | null,
    reservationId: string | null = null,
  ): Promise<CapacityReservation[]> {
    const reservations = await client.query<ReservationRow>(
      `SELECT r.id::text AS id,
              r.transport_request_id::text AS transport_request_id,
              r.proposal_id::text AS proposal_id,
              r.capacity_assignment_id::text AS capacity_assignment_id,
              r.driver_id::text AS driver_id,
              d.full_name AS driver_name,
              r.vehicle_id::text AS vehicle_id,
              v.identifier AS vehicle_identifier,
              v.plate AS vehicle_plate,
              r.carrier_party_id::text AS carrier_party_id,
              carrier.legal_name AS carrier_name,
              r.status::text AS status,
              r.approved_by_user_id::text AS approved_by_user_id,
              approver.display_name AS approved_by_name,
              r.approved_at,
              r.cancelled_by_user_id::text AS cancelled_by_user_id,
              canceller.display_name AS cancelled_by_name,
              r.cancelled_at,
              r.cancel_reason,
              r.released_by_user_id::text AS released_by_user_id,
              releaser.display_name AS released_by_name,
              r.released_at,
              r.release_reason,
              r.created_at,
              r.updated_at
         FROM capacity_reservations r
         JOIN drivers d ON d.tenant_id=r.tenant_id AND d.id=r.driver_id
         JOIN capacity_assets v ON v.tenant_id=r.tenant_id AND v.id=r.vehicle_id
         JOIN business_parties carrier
           ON carrier.tenant_id=r.tenant_id AND carrier.id=r.carrier_party_id
         JOIN users approver ON approver.id=r.approved_by_user_id
         LEFT JOIN users canceller ON canceller.id=r.cancelled_by_user_id
         LEFT JOIN users releaser ON releaser.id=r.released_by_user_id
        WHERE ($1::uuid IS NULL OR r.transport_request_id=$1::uuid)
          AND ($2::uuid IS NULL OR r.id=$2::uuid)
        ORDER BY r.created_at,r.id`,
      [requestId, reservationId],
    );

    const events = await client.query<ReservationEventRow>(
      `SELECT e.id::text AS id,
              e.reservation_id::text AS reservation_id,
              e.type::text AS type,
              e.actor_user_id::text AS actor_user_id,
              actor.display_name AS actor_name,
              e.reason,
              e.created_at
         FROM capacity_reservation_events e
         JOIN capacity_reservations r
           ON r.tenant_id=e.tenant_id AND r.id=e.reservation_id
         JOIN users actor ON actor.id=e.actor_user_id
        WHERE ($1::uuid IS NULL OR r.transport_request_id=$1::uuid)
          AND ($2::uuid IS NULL OR r.id=$2::uuid)
        ORDER BY r.created_at,e.created_at,e.id`,
      [requestId, reservationId],
    );

    return mapReservations(reservations.rows, events.rows);
  }

  private async loadOne(
    client: TenantQueryClient,
    reservationId: string,
  ): Promise<CapacityReservation> {
    const rows = await this.loadHistory(client, null, reservationId);
    const reservation = rows[0];
    if (!reservation) {
      throw new NotFoundException('Capacity reservation not found after mutation');
    }
    return reservation;
  }
}

function mapReservations(
  reservations: readonly ReservationRow[],
  events: readonly ReservationEventRow[],
): CapacityReservation[] {
  const eventsByReservation = new Map<string, CapacityReservationEvent[]>();
  for (const event of events) {
    const list = eventsByReservation.get(event.reservation_id) ?? [];
    list.push({
      id: event.id,
      type: event.type,
      actorUserId: event.actor_user_id,
      actorName: event.actor_name,
      reason: event.reason,
      createdAt: event.created_at.toISOString(),
    });
    eventsByReservation.set(event.reservation_id, list);
  }

  return reservations.map((row) => ({
    id: row.id,
    transportRequestId: row.transport_request_id,
    proposalId: row.proposal_id,
    capacityAssignmentId: row.capacity_assignment_id,
    driver: { id: row.driver_id, name: row.driver_name },
    vehicle: {
      id: row.vehicle_id,
      identifier: row.vehicle_identifier,
      plate: row.vehicle_plate,
    },
    carrier: { id: row.carrier_party_id, name: row.carrier_name },
    status: row.status,
    approvedBy: { userId: row.approved_by_user_id, name: row.approved_by_name },
    approvedAt: row.approved_at.toISOString(),
    cancelledBy:
      row.cancelled_by_user_id && row.cancelled_by_name
        ? { userId: row.cancelled_by_user_id, name: row.cancelled_by_name }
        : null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    cancelReason: row.cancel_reason,
    releasedBy:
      row.released_by_user_id && row.released_by_name
        ? { userId: row.released_by_user_id, name: row.released_by_name }
        : null,
    releasedAt: row.released_at?.toISOString() ?? null,
    releaseReason: row.release_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    events: eventsByReservation.get(row.id) ?? [],
  }));
}

function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === '23505';
}

function reservationConflictMessage(error: unknown): string {
  const constraint = errorConstraint(error);
  if (constraint?.includes('active_request')) {
    return 'Transport request already has an active capacity reservation';
  }
  if (constraint?.includes('active_assignment')) {
    return 'Selected capacity assignment is already reserved';
  }
  if (constraint?.includes('active_driver')) {
    return 'Selected driver is already reserved for another transport request';
  }
  if (constraint?.includes('active_vehicle')) {
    return 'Selected vehicle is already reserved for another transport request';
  }
  return 'Selected capacity is already reserved';
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const value = (error as { code?: unknown }).code;
  return typeof value === 'string' ? value : null;
}

function errorConstraint(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('constraint' in error)) return null;
  const value = (error as { constraint?: unknown }).constraint;
  return typeof value === 'string' ? value : null;
}
