import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import { parseTransportContractReason } from './transport-contract.validation.js';

interface ContractSourceRow {
  readonly reservation_id: string;
  readonly reservation_status: 'active' | 'cancelled';
  readonly transport_request_id: string;
  readonly request_status: string;
  readonly proposal_id: string;
  readonly proposal_status: string;
  readonly capacity_assignment_id: string;
  readonly driver_id: string;
  readonly vehicle_id: string;
  readonly carrier_party_id: string;
  readonly currency_code: string;
  readonly freight_amount: string;
  readonly toll_amount: string;
  readonly additional_amount: string;
  readonly payment_terms: string;
  readonly commercial_notes: string | null;
}

interface ContractIdentityRow {
  readonly id: string;
  readonly transport_request_id: string;
  readonly reservation_id: string;
  readonly status: 'confirmed' | 'refused' | 'cancelled';
}

interface ContractRow {
  readonly id: string;
  readonly transport_request_id: string;
  readonly reservation_id: string;
  readonly proposal_id: string;
  readonly capacity_assignment_id: string;
  readonly driver_id: string;
  readonly vehicle_id: string;
  readonly carrier_party_id: string;
  readonly status: 'confirmed' | 'refused' | 'cancelled';
  readonly currency_code: string;
  readonly freight_amount: string;
  readonly toll_amount: string;
  readonly additional_amount: string;
  readonly payment_terms: string;
  readonly commercial_notes: string | null;
  readonly confirmed_by_user_id: string | null;
  readonly confirmed_at: Date | null;
  readonly refused_by_user_id: string | null;
  readonly refused_at: Date | null;
  readonly refusal_reason: string | null;
  readonly cancelled_by_user_id: string | null;
  readonly cancelled_at: Date | null;
  readonly cancel_reason: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface ContractEventRow {
  readonly id: string;
  readonly contract_id: string;
  readonly type: 'confirmed' | 'refused' | 'cancelled';
  readonly actor_user_id: string;
  readonly reason: string | null;
  readonly created_at: Date;
}

export interface TransportContractEvent {
  readonly id: string;
  readonly type: 'confirmed' | 'refused' | 'cancelled';
  readonly actorUserId: string;
  readonly reason: string | null;
  readonly createdAt: string;
}

export interface TransportContract {
  readonly id: string;
  readonly transportRequestId: string;
  readonly reservationId: string;
  readonly proposalId: string;
  readonly capacityAssignmentId: string;
  readonly driverId: string;
  readonly vehicleId: string;
  readonly carrierPartyId: string;
  readonly status: 'confirmed' | 'refused' | 'cancelled';
  readonly commercialTerms: {
    readonly currencyCode: string;
    readonly freightAmount: string;
    readonly tollAmount: string;
    readonly additionalAmount: string;
    readonly totalAmount: string;
    readonly paymentTerms: string;
    readonly commercialNotes: string | null;
  };
  readonly confirmedByUserId: string | null;
  readonly confirmedAt: string | null;
  readonly refusedByUserId: string | null;
  readonly refusedAt: string | null;
  readonly refusalReason: string | null;
  readonly cancelledByUserId: string | null;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly events: readonly TransportContractEvent[];
}

@Injectable()
export class TransportContractService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async list(requestId: string): Promise<readonly TransportContract[]> {
    const transportRequestId = requireUuid(requestId, 'requestId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireRequest(client, transportRequestId);
      return this.loadHistory(client, transportRequestId);
    });
  }

  async confirm(reservationId: string): Promise<TransportContract> {
    const id = requireUuid(reservationId, 'reservationId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.lockReservation(client, context.tenantId, id);
      const source = await this.requireContractSource(client, id);
      this.validateContractSource(source);
      await this.lockRequest(client, context.tenantId, source.transport_request_id);

      const contractId = await this.insertContract(
        client,
        context.tenantId,
        source,
        'confirmed',
        context.userId,
        null,
      );
      await this.insertEvent(
        client,
        context.tenantId,
        contractId,
        'confirmed',
        context.userId,
        null,
      );

      const updated = await client.query<{ id: string }>(
        `UPDATE transport_requests
            SET status='contracted',updated_by_user_id=$2::uuid,updated_at=now()
          WHERE id=$1::uuid AND status IN ('ready_for_quote','in_negotiation')
          RETURNING id::text AS id`,
        [source.transport_request_id, context.userId],
      );
      if (!updated.rows[0]) {
        throw new ConflictException('Transport request changed before contract confirmation');
      }

      return this.loadOne(client, contractId);
    });
  }

  async refuse(reservationId: string, input: unknown): Promise<TransportContract> {
    const id = requireUuid(reservationId, 'reservationId');
    const refusal = parseTransportContractReason(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.lockReservation(client, context.tenantId, id);
      const source = await this.requireContractSource(client, id);
      this.validateContractSource(source);
      await this.lockRequest(client, context.tenantId, source.transport_request_id);

      const contractId = await this.insertContract(
        client,
        context.tenantId,
        source,
        'refused',
        context.userId,
        refusal.reason,
      );
      await this.insertEvent(
        client,
        context.tenantId,
        contractId,
        'refused',
        context.userId,
        refusal.reason,
      );
      await this.cancelReservation(
        client,
        context.tenantId,
        source.reservation_id,
        context.userId,
        `Contract refused: ${refusal.reason}`,
      );

      return this.loadOne(client, contractId);
    });
  }

  async cancel(contractId: string, input: unknown): Promise<TransportContract> {
    const id = requireUuid(contractId, 'contractId');
    const cancellation = parseTransportContractReason(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.lockContract(client, context.tenantId, id);
      const contract = await this.requireContractIdentity(client, id);
      if (contract.status !== 'confirmed') {
        throw new ConflictException(`Only a confirmed transport contract can be cancelled`);
      }

      await this.lockReservation(client, context.tenantId, contract.reservation_id);
      await this.lockRequest(client, context.tenantId, contract.transport_request_id);

      const result = await client.query<{ id: string }>(
        `UPDATE transport_contracts
            SET status='cancelled',
                cancelled_by_user_id=$2::uuid,
                cancelled_at=now(),
                cancel_reason=$3,
                updated_at=now()
          WHERE id=$1::uuid AND status='confirmed'
          RETURNING id::text AS id`,
        [id, context.userId, cancellation.reason],
      );
      if (!result.rows[0]) {
        throw new ConflictException('Transport contract changed concurrently');
      }

      await this.insertEvent(
        client,
        context.tenantId,
        id,
        'cancelled',
        context.userId,
        cancellation.reason,
      );
      await this.cancelReservation(
        client,
        context.tenantId,
        contract.reservation_id,
        context.userId,
        `Contract cancelled: ${cancellation.reason}`,
      );

      const request = await client.query<{ id: string }>(
        `UPDATE transport_requests
            SET status='in_negotiation',updated_by_user_id=$2::uuid,updated_at=now()
          WHERE id=$1::uuid AND status='contracted'
          RETURNING id::text AS id`,
        [contract.transport_request_id, context.userId],
      );
      if (!request.rows[0]) {
        throw new ConflictException('Contracted transport request changed before cancellation');
      }

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

  private async requireContractSource(
    client: TenantQueryClient,
    reservationId: string,
  ): Promise<ContractSourceRow> {
    const result = await client.query<ContractSourceRow>(
      `SELECT r.id::text AS reservation_id,
              r.status::text AS reservation_status,
              r.transport_request_id::text AS transport_request_id,
              tr.status::text AS request_status,
              r.proposal_id::text AS proposal_id,
              proposal_event.status::text AS proposal_status,
              r.capacity_assignment_id::text AS capacity_assignment_id,
              r.driver_id::text AS driver_id,
              r.vehicle_id::text AS vehicle_id,
              r.carrier_party_id::text AS carrier_party_id,
              p.currency_code,
              p.freight_amount::text AS freight_amount,
              p.toll_amount::text AS toll_amount,
              p.additional_amount::text AS additional_amount,
              p.payment_terms,
              p.commercial_notes
         FROM capacity_reservations r
         JOIN transport_requests tr
           ON tr.tenant_id=r.tenant_id AND tr.id=r.transport_request_id
         JOIN freight_proposals p
           ON p.tenant_id=r.tenant_id AND p.id=r.proposal_id
         JOIN LATERAL (
           SELECT status
             FROM freight_proposal_events
            WHERE tenant_id=p.tenant_id AND proposal_id=p.id
            ORDER BY created_at DESC,id DESC
            LIMIT 1
         ) proposal_event ON true
        WHERE r.id=$1::uuid`,
      [reservationId],
    );
    const source = result.rows[0];
    if (!source) {
      throw new NotFoundException('Capacity reservation not found in current tenant');
    }
    return source;
  }

  private validateContractSource(source: ContractSourceRow): void {
    if (source.reservation_status !== 'active') {
      throw new ConflictException('Only an active capacity reservation can be contracted');
    }
    if (source.proposal_status !== 'accepted') {
      throw new ConflictException('Reserved freight proposal is no longer accepted');
    }
    if (source.request_status !== 'ready_for_quote' && source.request_status !== 'in_negotiation') {
      throw new ConflictException(
        `Transport cannot be contracted while request status is ${source.request_status}`,
      );
    }
  }

  private async insertContract(
    client: TenantQueryClient,
    tenantId: string,
    source: ContractSourceRow,
    status: 'confirmed' | 'refused',
    actorUserId: string,
    reason: string | null,
  ): Promise<string> {
    try {
      const result = await client.query<{ id: string }>(
        `INSERT INTO transport_contracts (
           tenant_id,transport_request_id,reservation_id,proposal_id,capacity_assignment_id,
           driver_id,vehicle_id,carrier_party_id,status,currency_code,freight_amount,toll_amount,
           additional_amount,payment_terms,commercial_notes,
           confirmed_by_user_id,confirmed_at,refused_by_user_id,refused_at,refusal_reason
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9,
           $10,$11::numeric,$12::numeric,$13::numeric,$14,$15,
           CASE WHEN $9='confirmed' THEN $16::uuid ELSE NULL END,
           CASE WHEN $9='confirmed' THEN now() ELSE NULL END,
           CASE WHEN $9='refused' THEN $16::uuid ELSE NULL END,
           CASE WHEN $9='refused' THEN now() ELSE NULL END,
           CASE WHEN $9='refused' THEN $17 ELSE NULL END
         ) RETURNING id::text AS id`,
        [
          tenantId,
          source.transport_request_id,
          source.reservation_id,
          source.proposal_id,
          source.capacity_assignment_id,
          source.driver_id,
          source.vehicle_id,
          source.carrier_party_id,
          status,
          source.currency_code,
          source.freight_amount,
          source.toll_amount,
          source.additional_amount,
          source.payment_terms,
          source.commercial_notes,
          actorUserId,
          reason,
        ],
      );
      const id = result.rows[0]?.id;
      if (!id) {
        throw new ConflictException('Transport contract could not be created');
      }
      return id;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Reservation or selected capacity already has a contract decision',
        );
      }
      throw error;
    }
  }

  private async cancelReservation(
    client: TenantQueryClient,
    tenantId: string,
    reservationId: string,
    actorUserId: string,
    reason: string,
  ): Promise<void> {
    const result = await client.query<{ id: string }>(
      `UPDATE capacity_reservations
          SET status='cancelled',
              cancelled_by_user_id=$2::uuid,
              cancelled_at=now(),
              cancel_reason=$3,
              updated_at=now()
        WHERE id=$1::uuid AND status='active'
        RETURNING id::text AS id`,
      [reservationId, actorUserId, reason],
    );
    if (!result.rows[0]) {
      throw new ConflictException('Capacity reservation is no longer active');
    }

    await client.query(
      `INSERT INTO capacity_reservation_events (tenant_id,reservation_id,type,actor_user_id,reason)
       VALUES ($1::uuid,$2::uuid,'cancelled',$3::uuid,$4)`,
      [tenantId, reservationId, actorUserId, reason],
    );
  }

  private async requireContractIdentity(
    client: TenantQueryClient,
    contractId: string,
  ): Promise<ContractIdentityRow> {
    const result = await client.query<ContractIdentityRow>(
      `SELECT id::text AS id,
              transport_request_id::text AS transport_request_id,
              reservation_id::text AS reservation_id,
              status::text AS status
         FROM transport_contracts
        WHERE id=$1::uuid`,
      [contractId],
    );
    const contract = result.rows[0];
    if (!contract) {
      throw new NotFoundException('Transport contract not found in current tenant');
    }
    return contract;
  }

  private async insertEvent(
    client: TenantQueryClient,
    tenantId: string,
    contractId: string,
    type: 'confirmed' | 'refused' | 'cancelled',
    actorUserId: string,
    reason: string | null,
  ): Promise<void> {
    await client.query(
      `INSERT INTO transport_contract_events (tenant_id,contract_id,type,actor_user_id,reason)
       VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5)`,
      [tenantId, contractId, type, actorUserId, reason],
    );
  }

  private async loadOne(client: TenantQueryClient, contractId: string): Promise<TransportContract> {
    const contracts = await this.loadHistory(client, null, contractId);
    const contract = contracts[0];
    if (!contract) {
      throw new NotFoundException('Transport contract not found in current tenant');
    }
    return contract;
  }

  private async loadHistory(
    client: TenantQueryClient,
    requestId: string | null,
    contractId: string | null = null,
  ): Promise<TransportContract[]> {
    const contracts = await client.query<ContractRow>(
      `SELECT id::text AS id,
              transport_request_id::text AS transport_request_id,
              reservation_id::text AS reservation_id,
              proposal_id::text AS proposal_id,
              capacity_assignment_id::text AS capacity_assignment_id,
              driver_id::text AS driver_id,
              vehicle_id::text AS vehicle_id,
              carrier_party_id::text AS carrier_party_id,
              status::text AS status,
              currency_code,
              freight_amount::text AS freight_amount,
              toll_amount::text AS toll_amount,
              additional_amount::text AS additional_amount,
              payment_terms,
              commercial_notes,
              confirmed_by_user_id::text AS confirmed_by_user_id,
              confirmed_at,
              refused_by_user_id::text AS refused_by_user_id,
              refused_at,
              refusal_reason,
              cancelled_by_user_id::text AS cancelled_by_user_id,
              cancelled_at,
              cancel_reason,
              created_at,
              updated_at
         FROM transport_contracts
        WHERE ($1::uuid IS NULL OR transport_request_id=$1::uuid)
          AND ($2::uuid IS NULL OR id=$2::uuid)
        ORDER BY created_at,id`,
      [requestId, contractId],
    );

    if (contracts.rows.length === 0) {
      return [];
    }

    const ids = contracts.rows.map((contract) => contract.id);
    const events = await client.query<ContractEventRow>(
      `SELECT id::text AS id,
              contract_id::text AS contract_id,
              type::text AS type,
              actor_user_id::text AS actor_user_id,
              reason,
              created_at
         FROM transport_contract_events
        WHERE contract_id = ANY($1::uuid[])
        ORDER BY created_at,id`,
      [ids],
    );

    const eventsByContract = new Map<string, TransportContractEvent[]>();
    for (const event of events.rows) {
      const bucket = eventsByContract.get(event.contract_id) ?? [];
      bucket.push({
        id: event.id,
        type: event.type,
        actorUserId: event.actor_user_id,
        reason: event.reason,
        createdAt: event.created_at.toISOString(),
      });
      eventsByContract.set(event.contract_id, bucket);
    }

    return contracts.rows.map((contract) => ({
      id: contract.id,
      transportRequestId: contract.transport_request_id,
      reservationId: contract.reservation_id,
      proposalId: contract.proposal_id,
      capacityAssignmentId: contract.capacity_assignment_id,
      driverId: contract.driver_id,
      vehicleId: contract.vehicle_id,
      carrierPartyId: contract.carrier_party_id,
      status: contract.status,
      commercialTerms: {
        currencyCode: contract.currency_code,
        freightAmount: contract.freight_amount,
        tollAmount: contract.toll_amount,
        additionalAmount: contract.additional_amount,
        totalAmount: sumMoney(
          contract.freight_amount,
          contract.toll_amount,
          contract.additional_amount,
        ),
        paymentTerms: contract.payment_terms,
        commercialNotes: contract.commercial_notes,
      },
      confirmedByUserId: contract.confirmed_by_user_id,
      confirmedAt: contract.confirmed_at?.toISOString() ?? null,
      refusedByUserId: contract.refused_by_user_id,
      refusedAt: contract.refused_at?.toISOString() ?? null,
      refusalReason: contract.refusal_reason,
      cancelledByUserId: contract.cancelled_by_user_id,
      cancelledAt: contract.cancelled_at?.toISOString() ?? null,
      cancelReason: contract.cancel_reason,
      createdAt: contract.created_at.toISOString(),
      updatedAt: contract.updated_at.toISOString(),
      events: eventsByContract.get(contract.id) ?? [],
    }));
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

  private async lockRequest(
    client: TenantQueryClient,
    tenantId: string,
    requestId: string,
  ): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${tenantId}:${requestId}:transport-contract-request`,
    ]);
  }

  private async lockContract(
    client: TenantQueryClient,
    tenantId: string,
    contractId: string,
  ): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${tenantId}:${contractId}:transport-contract-state`,
    ]);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function sumMoney(...values: string[]): string {
  const cents = values.reduce((total, value) => total + Math.round(Number(value) * 100), 0);
  return (cents / 100).toFixed(2);
}
