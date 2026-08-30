import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';
import { CapacityMatchingService } from '../matching/capacity-matching.service.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  parseFreightCounterproposal,
  parseFreightProposalCreate,
  parseFreightProposalStatus,
  type FreightProposalStatus,
  type FreightProposalTermsInput,
} from './freight-proposal.validation.js';

interface RequestRow {
  readonly status: string;
}

interface AssignmentRow {
  readonly id: string;
  readonly carrier_party_id: string;
  readonly status: string;
}

interface ProposalRow {
  readonly id: string;
  readonly transport_request_id: string;
  readonly capacity_assignment_id: string;
  readonly carrier_party_id: string;
  readonly carrier_name: string;
  readonly parent_proposal_id: string | null;
  readonly sequence: number;
  readonly kind: 'proposal' | 'counterproposal';
  readonly currency_code: string;
  readonly freight_amount: string;
  readonly toll_amount: string;
  readonly additional_amount: string;
  readonly payment_terms: string;
  readonly commercial_notes: string | null;
  readonly expires_at: Date | null;
  readonly authored_by_user_id: string;
  readonly author_name: string;
  readonly created_at: Date;
  readonly current_status: FreightProposalStatus;
  readonly current_status_reason: string | null;
  readonly current_status_at: Date;
}

interface ProposalIdentityRow {
  readonly id: string;
  readonly transport_request_id: string;
  readonly capacity_assignment_id: string;
  readonly carrier_party_id: string;
  readonly expires_at: Date | null;
  readonly current_status: FreightProposalStatus;
}

interface EventRow {
  readonly id: string;
  readonly proposal_id: string;
  readonly status: FreightProposalStatus;
  readonly actor_user_id: string;
  readonly actor_name: string;
  readonly reason: string | null;
  readonly created_at: Date;
}

export interface FreightProposalEvent {
  readonly id: string;
  readonly status: FreightProposalStatus;
  readonly actorUserId: string;
  readonly actorName: string;
  readonly reason: string | null;
  readonly createdAt: string;
}

export interface FreightProposal {
  readonly id: string;
  readonly transportRequestId: string;
  readonly capacityAssignmentId: string;
  readonly carrier: {
    readonly id: string;
    readonly name: string;
  };
  readonly parentProposalId: string | null;
  readonly sequence: number;
  readonly kind: 'proposal' | 'counterproposal';
  readonly currencyCode: string;
  readonly freightAmount: number;
  readonly tollAmount: number;
  readonly additionalAmount: number;
  readonly totalAmount: number;
  readonly paymentTerms: string;
  readonly commercialNotes: string | null;
  readonly expiresAt: string | null;
  readonly authoredBy: {
    readonly userId: string;
    readonly name: string;
  };
  readonly createdAt: string;
  readonly status: FreightProposalStatus;
  readonly statusReason: string | null;
  readonly statusAt: string;
  readonly events: readonly FreightProposalEvent[];
}

@Injectable()
export class FreightProposalService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
    private readonly matching: CapacityMatchingService,
  ) {}

  async list(requestId: string): Promise<readonly FreightProposal[]> {
    const transportRequestId = requireUuid(requestId, 'requestId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireNegotiableRequest(client, transportRequestId, false);
      const proposalRows = await this.loadProposalRows(client, transportRequestId);
      const eventRows = await this.loadEventRows(client, transportRequestId);
      return mapProposalHistory(proposalRows, eventRows);
    });
  }

  async create(requestId: string, input: unknown): Promise<FreightProposal> {
    const transportRequestId = requireUuid(requestId, 'requestId');
    const proposal = parseFreightProposalCreate(input);
    const context = this.tenantContext.require();
    const match = await this.matching.search(transportRequestId);
    const candidate = match.compatible.find(
      (item) => item.assignmentId === proposal.capacityAssignmentId,
    );

    if (!candidate) {
      const incompatible = match.incompatible.find(
        (item) => item.assignmentId === proposal.capacityAssignmentId,
      );
      throw new ConflictException({
        message: 'Capacity assignment is not compatible with the transport request',
        reasons: incompatible?.reasons ?? [],
      });
    }

    return this.database.withTenantContext(context, async (client) => {
      await this.requireNegotiableRequest(client, transportRequestId, true);
      await this.requireActiveAssignment(
        client,
        proposal.capacityAssignmentId,
        candidate.carrier.id,
      );
      await this.lockRequestSequence(client, context.tenantId, transportRequestId);
      const sequence = await this.nextSequence(client, transportRequestId);

      const createdId = await this.insertProposal(client, {
        tenantId: context.tenantId,
        transportRequestId,
        capacityAssignmentId: proposal.capacityAssignmentId,
        carrierPartyId: candidate.carrier.id,
        parentProposalId: null,
        sequence,
        kind: 'proposal',
        terms: proposal,
        actorUserId: context.userId,
      });
      await this.insertEvent(client, context.tenantId, createdId, 'open', context.userId, null);

      return this.loadOne(client, createdId);
    });
  }

  async counterproposal(proposalId: string, input: unknown): Promise<FreightProposal> {
    const parentId = requireUuid(proposalId, 'proposalId');
    const terms = parseFreightCounterproposal(input);
    const context = this.tenantContext.require();

    const parentSnapshot = await this.database.withTenantContext(context, async (client) =>
      this.requireProposalIdentity(client, parentId),
    );
    const match = await this.matching.search(parentSnapshot.transport_request_id);
    const candidate = match.compatible.find(
      (item) => item.assignmentId === parentSnapshot.capacity_assignment_id,
    );
    if (!candidate) {
      throw new ConflictException(
        'Proposal capacity is no longer compatible with the transport request',
      );
    }

    return this.database.withTenantContext(context, async (client) => {
      await this.lockProposal(client, context.tenantId, parentId);
      const parent = await this.requireProposalIdentity(client, parentId);
      await this.requireNegotiableRequest(client, parent.transport_request_id, true);
      this.requireOpenProposal(parent);
      await this.requireActiveAssignment(
        client,
        parent.capacity_assignment_id,
        parent.carrier_party_id,
      );
      await this.lockRequestSequence(client, context.tenantId, parent.transport_request_id);
      const sequence = await this.nextSequence(client, parent.transport_request_id);

      const createdId = await this.insertProposal(client, {
        tenantId: context.tenantId,
        transportRequestId: parent.transport_request_id,
        capacityAssignmentId: parent.capacity_assignment_id,
        carrierPartyId: parent.carrier_party_id,
        parentProposalId: parent.id,
        sequence,
        kind: 'counterproposal',
        terms,
        actorUserId: context.userId,
      });

      await this.insertEvent(
        client,
        context.tenantId,
        parent.id,
        'rejected',
        context.userId,
        `Superseded by counterproposal ${createdId}`,
      );
      await this.insertEvent(client, context.tenantId, createdId, 'open', context.userId, null);

      return this.loadOne(client, createdId);
    });
  }

  async setStatus(proposalId: string, input: unknown): Promise<FreightProposal> {
    const id = requireUuid(proposalId, 'proposalId');
    const transition = parseFreightProposalStatus(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.lockProposal(client, context.tenantId, id);
      const proposal = await this.requireProposalIdentity(client, id);
      await this.requireNegotiableRequest(client, proposal.transport_request_id, true);
      this.requireOpenProposal(proposal);

      if (
        transition.status !== 'expired' &&
        proposal.expires_at !== null &&
        proposal.expires_at.valueOf() <= Date.now()
      ) {
        throw new ConflictException(
          'Proposal has passed its expiration date and can only be expired',
        );
      }

      await this.insertEvent(
        client,
        context.tenantId,
        proposal.id,
        transition.status,
        context.userId,
        transition.reason,
      );
      return this.loadOne(client, proposal.id);
    });
  }

  private async requireNegotiableRequest(
    client: TenantQueryClient,
    requestId: string,
    forMutation: boolean,
  ): Promise<RequestRow> {
    const result = await client.query<RequestRow>(
      `SELECT status::text AS status
         FROM transport_requests
        WHERE id=$1::uuid`,
      [requestId],
    );
    const request = result.rows[0];
    if (!request) {
      throw new NotFoundException('Transport request not found in current tenant');
    }
    if (
      forMutation &&
      request.status !== 'ready_for_quote' &&
      request.status !== 'in_negotiation'
    ) {
      throw new ConflictException(
        `Freight proposals cannot be changed while transport request status is ${request.status}`,
      );
    }
    return request;
  }

  private async requireActiveAssignment(
    client: TenantQueryClient,
    assignmentId: string,
    expectedCarrierId: string,
  ): Promise<AssignmentRow> {
    const result = await client.query<AssignmentRow>(
      `SELECT id::text AS id, carrier_party_id::text AS carrier_party_id, status::text AS status
         FROM capacity_assignments
        WHERE id=$1::uuid`,
      [assignmentId],
    );
    const assignment = result.rows[0];
    if (!assignment) {
      throw new NotFoundException('Capacity assignment not found in current tenant');
    }
    if (assignment.status !== 'active') {
      throw new ConflictException('Capacity assignment is not active');
    }
    if (assignment.carrier_party_id !== expectedCarrierId) {
      throw new ConflictException('Capacity assignment carrier does not match proposal carrier');
    }
    return assignment;
  }

  private async requireProposalIdentity(
    client: TenantQueryClient,
    proposalId: string,
  ): Promise<ProposalIdentityRow> {
    const result = await client.query<ProposalIdentityRow>(
      `SELECT p.id::text AS id,
              p.transport_request_id::text AS transport_request_id,
              p.capacity_assignment_id::text AS capacity_assignment_id,
              p.carrier_party_id::text AS carrier_party_id,
              p.expires_at,
              e.status::text AS current_status
         FROM freight_proposals p
         JOIN LATERAL (
           SELECT status
             FROM freight_proposal_events
            WHERE tenant_id=p.tenant_id AND proposal_id=p.id
            ORDER BY created_at DESC,id DESC
            LIMIT 1
         ) e ON true
        WHERE p.id=$1::uuid`,
      [proposalId],
    );
    const proposal = result.rows[0];
    if (!proposal) {
      throw new NotFoundException('Freight proposal not found in current tenant');
    }
    return proposal;
  }

  private requireOpenProposal(proposal: ProposalIdentityRow): void {
    if (proposal.current_status !== 'open') {
      throw new ConflictException(`Proposal is already ${proposal.current_status}`);
    }
  }

  private async lockProposal(
    client: TenantQueryClient,
    tenantId: string,
    proposalId: string,
  ): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${tenantId}:${proposalId}:freight-proposal-state`,
    ]);
  }

  private async lockRequestSequence(
    client: TenantQueryClient,
    tenantId: string,
    requestId: string,
  ): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${tenantId}:${requestId}:freight-proposal-sequence`,
    ]);
  }

  private async nextSequence(client: TenantQueryClient, requestId: string): Promise<number> {
    const result = await client.query<{ next_sequence: number }>(
      `SELECT COALESCE(MAX(sequence),0)::int + 1 AS next_sequence
         FROM freight_proposals
        WHERE transport_request_id=$1::uuid`,
      [requestId],
    );
    return result.rows[0]?.next_sequence ?? 1;
  }

  private async insertProposal(
    client: TenantQueryClient,
    input: {
      tenantId: string;
      transportRequestId: string;
      capacityAssignmentId: string;
      carrierPartyId: string;
      parentProposalId: string | null;
      sequence: number;
      kind: 'proposal' | 'counterproposal';
      terms: FreightProposalTermsInput;
      actorUserId: string;
    },
  ): Promise<string> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO freight_proposals (
         tenant_id,transport_request_id,capacity_assignment_id,carrier_party_id,parent_proposal_id,
         sequence,kind,currency_code,freight_amount,toll_amount,additional_amount,payment_terms,
         commercial_notes,expires_at,authored_by_user_id
       ) VALUES (
         $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9::numeric,$10::numeric,$11::numeric,
         $12,$13,$14::timestamptz,$15::uuid
       ) RETURNING id::text AS id`,
      [
        input.tenantId,
        input.transportRequestId,
        input.capacityAssignmentId,
        input.carrierPartyId,
        input.parentProposalId,
        input.sequence,
        input.kind,
        input.terms.currencyCode,
        input.terms.freightAmount,
        input.terms.tollAmount,
        input.terms.additionalAmount,
        input.terms.paymentTerms,
        input.terms.commercialNotes,
        input.terms.expiresAt,
        input.actorUserId,
      ],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new ConflictException('Freight proposal could not be created');
    return id;
  }

  private async insertEvent(
    client: TenantQueryClient,
    tenantId: string,
    proposalId: string,
    status: FreightProposalStatus,
    actorUserId: string,
    reason: string | null,
  ): Promise<void> {
    await client.query(
      `INSERT INTO freight_proposal_events (tenant_id,proposal_id,status,actor_user_id,reason)
       VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5)`,
      [tenantId, proposalId, status, actorUserId, reason],
    );
  }

  private async loadOne(client: TenantQueryClient, proposalId: string): Promise<FreightProposal> {
    const rows = await this.loadProposalRows(client, null, proposalId);
    const row = rows[0];
    if (!row) throw new NotFoundException('Freight proposal not found after mutation');
    const events = await this.loadEventRows(client, null, proposalId);
    return mapProposalHistory(rows, events)[0]!;
  }

  private async loadProposalRows(
    client: TenantQueryClient,
    requestId: string | null,
    proposalId: string | null = null,
  ): Promise<ProposalRow[]> {
    const result = await client.query<ProposalRow>(
      `SELECT p.id::text AS id,
              p.transport_request_id::text AS transport_request_id,
              p.capacity_assignment_id::text AS capacity_assignment_id,
              p.carrier_party_id::text AS carrier_party_id,
              carrier.legal_name AS carrier_name,
              p.parent_proposal_id::text AS parent_proposal_id,
              p.sequence,
              p.kind::text AS kind,
              p.currency_code,
              p.freight_amount::text AS freight_amount,
              p.toll_amount::text AS toll_amount,
              p.additional_amount::text AS additional_amount,
              p.payment_terms,
              p.commercial_notes,
              p.expires_at,
              p.authored_by_user_id::text AS authored_by_user_id,
              author.display_name AS author_name,
              p.created_at,
              current_event.status::text AS current_status,
              current_event.reason AS current_status_reason,
              current_event.created_at AS current_status_at
         FROM freight_proposals p
         JOIN business_parties carrier
           ON carrier.tenant_id=p.tenant_id AND carrier.id=p.carrier_party_id
         JOIN users author ON author.id=p.authored_by_user_id
         JOIN LATERAL (
           SELECT status,reason,created_at,id
             FROM freight_proposal_events
            WHERE tenant_id=p.tenant_id AND proposal_id=p.id
            ORDER BY created_at DESC,id DESC
            LIMIT 1
         ) current_event ON true
        WHERE ($1::uuid IS NULL OR p.transport_request_id=$1::uuid)
          AND ($2::uuid IS NULL OR p.id=$2::uuid)
        ORDER BY p.sequence,p.created_at,p.id`,
      [requestId, proposalId],
    );
    return result.rows;
  }

  private async loadEventRows(
    client: TenantQueryClient,
    requestId: string | null,
    proposalId: string | null = null,
  ): Promise<EventRow[]> {
    const result = await client.query<EventRow>(
      `SELECT e.id::text AS id,
              e.proposal_id::text AS proposal_id,
              e.status::text AS status,
              e.actor_user_id::text AS actor_user_id,
              actor.display_name AS actor_name,
              e.reason,
              e.created_at
         FROM freight_proposal_events e
         JOIN freight_proposals p ON p.tenant_id=e.tenant_id AND p.id=e.proposal_id
         JOIN users actor ON actor.id=e.actor_user_id
        WHERE ($1::uuid IS NULL OR p.transport_request_id=$1::uuid)
          AND ($2::uuid IS NULL OR p.id=$2::uuid)
        ORDER BY p.sequence,e.created_at,e.id`,
      [requestId, proposalId],
    );
    return result.rows;
  }
}

function mapProposalHistory(
  proposals: readonly ProposalRow[],
  events: readonly EventRow[],
): FreightProposal[] {
  const eventsByProposal = new Map<string, FreightProposalEvent[]>();
  for (const event of events) {
    const list = eventsByProposal.get(event.proposal_id) ?? [];
    list.push({
      id: event.id,
      status: event.status,
      actorUserId: event.actor_user_id,
      actorName: event.actor_name,
      reason: event.reason,
      createdAt: event.created_at.toISOString(),
    });
    eventsByProposal.set(event.proposal_id, list);
  }

  return proposals.map((row) => {
    const freightAmount = Number(row.freight_amount);
    const tollAmount = Number(row.toll_amount);
    const additionalAmount = Number(row.additional_amount);
    return {
      id: row.id,
      transportRequestId: row.transport_request_id,
      capacityAssignmentId: row.capacity_assignment_id,
      carrier: { id: row.carrier_party_id, name: row.carrier_name },
      parentProposalId: row.parent_proposal_id,
      sequence: row.sequence,
      kind: row.kind,
      currencyCode: row.currency_code,
      freightAmount,
      tollAmount,
      additionalAmount,
      totalAmount: Math.round((freightAmount + tollAmount + additionalAmount) * 100) / 100,
      paymentTerms: row.payment_terms,
      commercialNotes: row.commercial_notes,
      expiresAt: row.expires_at?.toISOString() ?? null,
      authoredBy: { userId: row.authored_by_user_id, name: row.author_name },
      createdAt: row.created_at.toISOString(),
      status: row.current_status,
      statusReason: row.current_status_reason,
      statusAt: row.current_status_at.toISOString(),
      events: eventsByProposal.get(row.id) ?? [],
    };
  });
}
