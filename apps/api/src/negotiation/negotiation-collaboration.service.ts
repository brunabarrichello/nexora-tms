import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  parseNegotiationMessageCreate,
  parseNegotiationParticipantCreate,
  parseNegotiationThreadCreate,
  parseNegotiationThreadStatus,
  type NegotiationMessageCreateInput,
  type NegotiationParticipantCreateInput,
  type NegotiationParticipantKind,
  type NegotiationParticipantRole,
  type NegotiationThreadTransition,
} from './negotiation-collaboration.validation.js';

interface MembershipRow {
  readonly id: string;
  readonly display_name: string | null;
}

interface RequestRow {
  readonly id: string;
  readonly status: string;
}

interface ThreadRow {
  readonly id: string;
  readonly transport_request_id: string;
  readonly subject: string;
  readonly status: 'open' | 'closed' | 'cancelled';
  readonly created_by_membership_id: string;
  readonly created_by_name: string | null;
  readonly closed_by_membership_id: string | null;
  readonly closed_by_name: string | null;
  readonly closed_at: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface ParticipantRow {
  readonly id: string;
  readonly thread_id: string;
  readonly kind: NegotiationParticipantKind;
  readonly role: NegotiationParticipantRole;
  readonly membership_id: string | null;
  readonly member_name: string | null;
  readonly business_party_id: string | null;
  readonly business_party_name: string | null;
  readonly business_party_contact_id: string | null;
  readonly contact_name: string | null;
  readonly added_by_membership_id: string;
  readonly added_by_name: string | null;
  readonly removed_by_membership_id: string | null;
  readonly removed_by_name: string | null;
  readonly joined_at: Date;
  readonly left_at: Date | null;
}

interface MessageRow {
  readonly id: string;
  readonly thread_id: string;
  readonly transport_request_id: string;
  readonly author_participant_id: string | null;
  readonly author_name: string | null;
  readonly kind: 'message' | 'note' | 'system';
  readonly body: string;
  readonly related_proposal_id: string | null;
  readonly reply_to_message_id: string | null;
  readonly created_at: Date;
}

interface ParticipantIdentityRow {
  readonly id: string;
  readonly kind: NegotiationParticipantKind;
  readonly membership_id: string | null;
  readonly left_at: Date | null;
}

export interface NegotiationThread {
  readonly id: string;
  readonly transportRequestId: string;
  readonly subject: string;
  readonly status: 'open' | 'closed' | 'cancelled';
  readonly createdBy: {
    readonly membershipId: string;
    readonly name: string | null;
  };
  readonly closedBy: {
    readonly membershipId: string;
    readonly name: string | null;
  } | null;
  readonly closedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NegotiationParticipant {
  readonly id: string;
  readonly threadId: string;
  readonly kind: NegotiationParticipantKind;
  readonly role: NegotiationParticipantRole;
  readonly membership: {
    readonly id: string;
    readonly name: string | null;
  } | null;
  readonly businessParty: {
    readonly id: string;
    readonly name: string | null;
  } | null;
  readonly businessPartyContact: {
    readonly id: string;
    readonly name: string | null;
  } | null;
  readonly addedBy: {
    readonly membershipId: string;
    readonly name: string | null;
  };
  readonly removedBy: {
    readonly membershipId: string;
    readonly name: string | null;
  } | null;
  readonly joinedAt: string;
  readonly leftAt: string | null;
}

export interface NegotiationMessage {
  readonly id: string;
  readonly threadId: string;
  readonly transportRequestId: string;
  readonly authorParticipantId: string | null;
  readonly authorName: string | null;
  readonly kind: 'message' | 'note' | 'system';
  readonly body: string;
  readonly relatedProposalId: string | null;
  readonly replyToMessageId: string | null;
  readonly createdAt: string;
}

@Injectable()
export class NegotiationCollaborationService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async listThreads(requestId: string): Promise<readonly NegotiationThread[]> {
    const transportRequestId = requireUuid(requestId, 'requestId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireRequest(client, transportRequestId, false);
      return (await this.loadThreadRows(client, transportRequestId, null)).map(mapThread);
    });
  }

  async getThread(threadId: string): Promise<NegotiationThread> {
    const id = requireUuid(threadId, 'threadId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) =>
      mapThread(await this.requireThread(client, id, false)),
    );
  }

  async createThread(requestId: string, input: unknown): Promise<NegotiationThread> {
    const transportRequestId = requireUuid(requestId, 'requestId');
    const thread = parseNegotiationThreadCreate(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireRequest(client, transportRequestId, true);
      const actor = await this.requireCurrentMembership(client, context.userId);

      const created = await client.query<{ id: string }>(
        `INSERT INTO negotiation_threads (
           tenant_id,transport_request_id,subject,created_by_membership_id
         ) VALUES ($1::uuid,$2::uuid,$3,$4::uuid)
         RETURNING id::text AS id`,
        [context.tenantId, transportRequestId, thread.subject, actor.id],
      );
      const createdId = created.rows[0]?.id;
      if (!createdId) throw new ConflictException('Negotiation thread could not be created');

      await client.query(
        `INSERT INTO negotiation_participants (
           tenant_id,thread_id,kind,role,membership_id,added_by_membership_id
         ) VALUES ($1::uuid,$2::uuid,'internal','operator',$3::uuid,$3::uuid)`,
        [context.tenantId, createdId, actor.id],
      );

      return mapThread(await this.requireThread(client, createdId, false));
    });
  }

  async setThreadStatus(threadId: string, input: unknown): Promise<NegotiationThread> {
    const id = requireUuid(threadId, 'threadId');
    const transition = parseNegotiationThreadStatus(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const actor = await this.requireCurrentMembership(client, context.userId);
      const thread = await this.requireThread(client, id, true);
      this.requireOpenThread(thread, transition.status);

      await client.query(
        `UPDATE negotiation_threads
            SET status=$1,
                closed_by_membership_id=$2::uuid,
                closed_at=now(),
                updated_at=now()
          WHERE id=$3::uuid`,
        [transition.status, actor.id, id],
      );
      return mapThread(await this.requireThread(client, id, false));
    });
  }

  async listParticipants(threadId: string): Promise<readonly NegotiationParticipant[]> {
    const id = requireUuid(threadId, 'threadId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireThread(client, id, false);
      return (await this.loadParticipantRows(client, id)).map(mapParticipant);
    });
  }

  async addParticipant(threadId: string, input: unknown): Promise<NegotiationParticipant> {
    const id = requireUuid(threadId, 'threadId');
    const participant = parseNegotiationParticipantCreate(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const actor = await this.requireCurrentMembership(client, context.userId);
      const thread = await this.requireThread(client, id, true);
      this.requireOpenThread(thread, null);
      await this.requireParticipantIdentity(client, participant);

      try {
        const created = await client.query<{ id: string }>(
          `INSERT INTO negotiation_participants (
             tenant_id,thread_id,kind,role,membership_id,business_party_id,
             business_party_contact_id,added_by_membership_id
           ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::uuid,$7::uuid,$8::uuid)
           RETURNING id::text AS id`,
          [
            context.tenantId,
            id,
            participant.kind,
            participant.role,
            participant.membershipId,
            participant.businessPartyId,
            participant.businessPartyContactId,
            actor.id,
          ],
        );
        const participantId = created.rows[0]?.id;
        if (!participantId) throw new ConflictException('Negotiation participant could not be added');
        return mapParticipant(await this.requireParticipantRow(client, id, participantId));
      } catch (error) {
        if (hasPgCode(error, '23505')) {
          throw new ConflictException('Participant is already active in this negotiation thread');
        }
        throw error;
      }
    });
  }

  async removeParticipant(threadId: string, participantId: string): Promise<NegotiationParticipant> {
    const id = requireUuid(threadId, 'threadId');
    const targetId = requireUuid(participantId, 'participantId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const actor = await this.requireCurrentMembership(client, context.userId);
      const thread = await this.requireThread(client, id, true);
      this.requireOpenThread(thread, null);
      const target = await this.requireParticipantIdentityRow(client, id, targetId, true);
      if (target.left_at) {
        throw new ConflictException('Participant has already left the negotiation thread');
      }

      if (target.kind === 'internal') {
        const active = await client.query<{ count: number }>(
          `SELECT count(*)::int AS count
             FROM negotiation_participants
            WHERE thread_id=$1::uuid
              AND kind='internal'
              AND left_at IS NULL`,
          [id],
        );
        if ((active.rows[0]?.count ?? 0) <= 1) {
          throw new ConflictException('The last active internal participant cannot be removed');
        }
      }

      await client.query(
        `UPDATE negotiation_participants
            SET left_at=now(), removed_by_membership_id=$1::uuid
          WHERE thread_id=$2::uuid AND id=$3::uuid`,
        [actor.id, id, targetId],
      );
      return mapParticipant(await this.requireParticipantRow(client, id, targetId));
    });
  }

  async listMessages(threadId: string): Promise<readonly NegotiationMessage[]> {
    const id = requireUuid(threadId, 'threadId');
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireThread(client, id, false);
      return (await this.loadMessageRows(client, id, null)).map(mapMessage);
    });
  }

  async createMessage(threadId: string, input: unknown): Promise<NegotiationMessage> {
    const id = requireUuid(threadId, 'threadId');
    const message = parseNegotiationMessageCreate(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const actor = await this.requireCurrentMembership(client, context.userId);
      const thread = await this.requireThread(client, id, true);
      this.requireOpenThread(thread, null);
      const author = await this.requireActiveInternalParticipant(client, id, actor.id);
      await this.requireMessageReferences(client, thread, message);

      try {
        const created = await client.query<{ id: string }>(
          `INSERT INTO negotiation_messages (
             tenant_id,thread_id,transport_request_id,author_participant_id,kind,body,
             related_proposal_id,reply_to_message_id
           ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7::uuid,$8::uuid)
           RETURNING id::text AS id`,
          [
            context.tenantId,
            id,
            thread.transport_request_id,
            author.id,
            message.kind,
            message.body,
            message.relatedProposalId,
            message.replyToMessageId,
          ],
        );
        const messageId = created.rows[0]?.id;
        if (!messageId) throw new ConflictException('Negotiation message could not be created');
        return mapMessage(await this.requireMessageRow(client, id, messageId));
      } catch (error) {
        if (hasPgCode(error, '23503')) {
          throw new ConflictException('Negotiation message reference is outside the current thread');
        }
        throw error;
      }
    });
  }

  private async requireRequest(
    client: TenantQueryClient,
    requestId: string,
    forMutation: boolean,
  ): Promise<RequestRow> {
    const result = await client.query<RequestRow>(
      `SELECT id::text AS id,status::text AS status
         FROM transport_requests
        WHERE id=$1::uuid`,
      [requestId],
    );
    const request = result.rows[0];
    if (!request) throw new NotFoundException('Transport request not found in current tenant');
    if (
      forMutation &&
      request.status !== 'ready_for_quote' &&
      request.status !== 'in_negotiation'
    ) {
      throw new ConflictException(
        `Negotiation cannot be changed while transport request status is ${request.status}`,
      );
    }
    return request;
  }

  private async requireCurrentMembership(
    client: TenantQueryClient,
    userId: string,
  ): Promise<MembershipRow> {
    const result = await client.query<MembershipRow>(
      `SELECT m.id::text AS id,u.display_name
         FROM memberships m
         JOIN users u ON u.id=m.user_id
        WHERE m.user_id=$1::uuid AND m.status='active'`,
      [userId],
    );
    const membership = result.rows[0];
    if (!membership) {
      throw new ConflictException('Current user does not have an active tenant membership');
    }
    return membership;
  }

  private async requireThread(
    client: TenantQueryClient,
    threadId: string,
    forUpdate: boolean,
  ): Promise<ThreadRow> {
    const rows = await this.loadThreadRows(client, null, threadId, forUpdate);
    const row = rows[0];
    if (!row) throw new NotFoundException('Negotiation thread not found in current tenant');
    return row;
  }

  private requireOpenThread(thread: ThreadRow, transition: NegotiationThreadTransition | null): void {
    if (thread.status !== 'open') {
      throw new ConflictException(`Negotiation thread is already ${thread.status}`);
    }
    if (transition && transition !== 'closed' && transition !== 'cancelled') {
      throw new ConflictException('Invalid negotiation thread transition');
    }
  }

  private async loadThreadRows(
    client: TenantQueryClient,
    requestId: string | null,
    threadId: string | null,
    forUpdate = false,
  ): Promise<ThreadRow[]> {
    const result = await client.query<ThreadRow>(
      `SELECT t.id::text AS id,
              t.transport_request_id::text AS transport_request_id,
              t.subject,
              t.status::text AS status,
              t.created_by_membership_id::text AS created_by_membership_id,
              creator.display_name AS created_by_name,
              t.closed_by_membership_id::text AS closed_by_membership_id,
              closer.display_name AS closed_by_name,
              t.closed_at,t.created_at,t.updated_at
         FROM negotiation_threads t
         JOIN memberships cm ON cm.id=t.created_by_membership_id AND cm.tenant_id=t.tenant_id
         JOIN users creator ON creator.id=cm.user_id
         LEFT JOIN memberships xm ON xm.id=t.closed_by_membership_id AND xm.tenant_id=t.tenant_id
         LEFT JOIN users closer ON closer.id=xm.user_id
        WHERE ($1::uuid IS NULL OR t.transport_request_id=$1::uuid)
          AND ($2::uuid IS NULL OR t.id=$2::uuid)
        ORDER BY t.updated_at DESC,t.id DESC
        ${forUpdate ? 'FOR UPDATE OF t' : ''}`,
      [requestId, threadId],
    );
    return result.rows;
  }

  private async requireParticipantIdentity(
    client: TenantQueryClient,
    participant: NegotiationParticipantCreateInput,
  ): Promise<void> {
    if (participant.kind === 'internal') {
      const result = await client.query<{ id: string; status: string }>(
        `SELECT id::text AS id,status::text AS status
           FROM memberships
          WHERE id=$1::uuid`,
        [participant.membershipId],
      );
      const membership = result.rows[0];
      if (!membership) throw new NotFoundException('Membership not found in current tenant');
      if (membership.status !== 'active') {
        throw new ConflictException('Internal participant membership is not active');
      }
      return;
    }

    const party = await client.query<{ status: string }>(
      `SELECT status::text AS status FROM business_parties WHERE id=$1::uuid`,
      [participant.businessPartyId],
    );
    const partyRow = party.rows[0];
    if (!partyRow) throw new NotFoundException('Business party not found in current tenant');
    if (partyRow.status !== 'active') {
      throw new ConflictException('External participant business party is not active');
    }

    if (participant.businessPartyContactId) {
      const contact = await client.query<{ id: string; is_active: boolean }>(
        `SELECT id::text AS id,is_active
           FROM business_party_contacts
          WHERE party_id=$1::uuid AND id=$2::uuid`,
        [participant.businessPartyId, participant.businessPartyContactId],
      );
      const contactRow = contact.rows[0];
      if (!contactRow) {
        throw new NotFoundException('Business party contact not found for external participant');
      }
      if (!contactRow.is_active) {
        throw new ConflictException('External participant contact is inactive');
      }
    }
  }

  private async loadParticipantRows(
    client: TenantQueryClient,
    threadId: string,
    participantId: string | null = null,
  ): Promise<ParticipantRow[]> {
    const result = await client.query<ParticipantRow>(
      `SELECT p.id::text AS id,
              p.thread_id::text AS thread_id,
              p.kind::text AS kind,
              p.role::text AS role,
              p.membership_id::text AS membership_id,
              member_user.display_name AS member_name,
              p.business_party_id::text AS business_party_id,
              bp.legal_name AS business_party_name,
              p.business_party_contact_id::text AS business_party_contact_id,
              bpc.name AS contact_name,
              p.added_by_membership_id::text AS added_by_membership_id,
              added_user.display_name AS added_by_name,
              p.removed_by_membership_id::text AS removed_by_membership_id,
              removed_user.display_name AS removed_by_name,
              p.joined_at,p.left_at
         FROM negotiation_participants p
         LEFT JOIN memberships member_m ON member_m.id=p.membership_id AND member_m.tenant_id=p.tenant_id
         LEFT JOIN users member_user ON member_user.id=member_m.user_id
         LEFT JOIN business_parties bp ON bp.id=p.business_party_id AND bp.tenant_id=p.tenant_id
         LEFT JOIN business_party_contacts bpc
           ON bpc.id=p.business_party_contact_id
          AND bpc.party_id=p.business_party_id
          AND bpc.tenant_id=p.tenant_id
         JOIN memberships added_m ON added_m.id=p.added_by_membership_id AND added_m.tenant_id=p.tenant_id
         JOIN users added_user ON added_user.id=added_m.user_id
         LEFT JOIN memberships removed_m ON removed_m.id=p.removed_by_membership_id AND removed_m.tenant_id=p.tenant_id
         LEFT JOIN users removed_user ON removed_user.id=removed_m.user_id
        WHERE p.thread_id=$1::uuid
          AND ($2::uuid IS NULL OR p.id=$2::uuid)
        ORDER BY p.joined_at,p.id`,
      [threadId, participantId],
    );
    return result.rows;
  }

  private async requireParticipantRow(
    client: TenantQueryClient,
    threadId: string,
    participantId: string,
  ): Promise<ParticipantRow> {
    const rows = await this.loadParticipantRows(client, threadId, participantId);
    const row = rows[0];
    if (!row) throw new NotFoundException('Negotiation participant not found in current tenant');
    return row;
  }

  private async requireParticipantIdentityRow(
    client: TenantQueryClient,
    threadId: string,
    participantId: string,
    forUpdate: boolean,
  ): Promise<ParticipantIdentityRow> {
    const result = await client.query<ParticipantIdentityRow>(
      `SELECT id::text AS id,kind::text AS kind,membership_id::text AS membership_id,left_at
         FROM negotiation_participants
        WHERE thread_id=$1::uuid AND id=$2::uuid
        ${forUpdate ? 'FOR UPDATE' : ''}`,
      [threadId, participantId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Negotiation participant not found in current tenant');
    return row;
  }

  private async requireActiveInternalParticipant(
    client: TenantQueryClient,
    threadId: string,
    membershipId: string,
  ): Promise<ParticipantIdentityRow> {
    const result = await client.query<ParticipantIdentityRow>(
      `SELECT id::text AS id,kind::text AS kind,membership_id::text AS membership_id,left_at
         FROM negotiation_participants
        WHERE thread_id=$1::uuid
          AND kind='internal'
          AND membership_id=$2::uuid
          AND left_at IS NULL`,
      [threadId, membershipId],
    );
    const participant = result.rows[0];
    if (!participant) {
      throw new ConflictException('Current user is not an active participant in this negotiation thread');
    }
    return participant;
  }

  private async requireMessageReferences(
    client: TenantQueryClient,
    thread: ThreadRow,
    message: NegotiationMessageCreateInput,
  ): Promise<void> {
    if (message.relatedProposalId) {
      const proposal = await client.query<{ id: string }>(
        `SELECT id::text AS id
           FROM freight_proposals
          WHERE id=$1::uuid AND transport_request_id=$2::uuid`,
        [message.relatedProposalId, thread.transport_request_id],
      );
      if (!proposal.rows[0]) {
        throw new NotFoundException('Related freight proposal does not belong to this negotiation request');
      }
    }

    if (message.replyToMessageId) {
      const reply = await client.query<{ id: string }>(
        `SELECT id::text AS id
           FROM negotiation_messages
          WHERE id=$1::uuid AND thread_id=$2::uuid`,
        [message.replyToMessageId, thread.id],
      );
      if (!reply.rows[0]) {
        throw new NotFoundException('Reply target does not belong to this negotiation thread');
      }
    }
  }

  private async loadMessageRows(
    client: TenantQueryClient,
    threadId: string,
    messageId: string | null,
  ): Promise<MessageRow[]> {
    const result = await client.query<MessageRow>(
      `SELECT msg.id::text AS id,
              msg.thread_id::text AS thread_id,
              msg.transport_request_id::text AS transport_request_id,
              msg.author_participant_id::text AS author_participant_id,
              COALESCE(member_user.display_name,bpc.name,bp.legal_name) AS author_name,
              msg.kind::text AS kind,
              msg.body,
              msg.related_proposal_id::text AS related_proposal_id,
              msg.reply_to_message_id::text AS reply_to_message_id,
              msg.created_at
         FROM negotiation_messages msg
         LEFT JOIN negotiation_participants p
           ON p.id=msg.author_participant_id
          AND p.thread_id=msg.thread_id
          AND p.tenant_id=msg.tenant_id
         LEFT JOIN memberships member_m ON member_m.id=p.membership_id AND member_m.tenant_id=p.tenant_id
         LEFT JOIN users member_user ON member_user.id=member_m.user_id
         LEFT JOIN business_parties bp ON bp.id=p.business_party_id AND bp.tenant_id=p.tenant_id
         LEFT JOIN business_party_contacts bpc
           ON bpc.id=p.business_party_contact_id
          AND bpc.party_id=p.business_party_id
          AND bpc.tenant_id=p.tenant_id
        WHERE msg.thread_id=$1::uuid
          AND ($2::uuid IS NULL OR msg.id=$2::uuid)
        ORDER BY msg.created_at,msg.id`,
      [threadId, messageId],
    );
    return result.rows;
  }

  private async requireMessageRow(
    client: TenantQueryClient,
    threadId: string,
    messageId: string,
  ): Promise<MessageRow> {
    const rows = await this.loadMessageRows(client, threadId, messageId);
    const row = rows[0];
    if (!row) throw new NotFoundException('Negotiation message not found after creation');
    return row;
  }
}

function mapThread(row: ThreadRow): NegotiationThread {
  return {
    id: row.id,
    transportRequestId: row.transport_request_id,
    subject: row.subject,
    status: row.status,
    createdBy: {
      membershipId: row.created_by_membership_id,
      name: row.created_by_name,
    },
    closedBy: row.closed_by_membership_id
      ? { membershipId: row.closed_by_membership_id, name: row.closed_by_name }
      : null,
    closedAt: row.closed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapParticipant(row: ParticipantRow): NegotiationParticipant {
  return {
    id: row.id,
    threadId: row.thread_id,
    kind: row.kind,
    role: row.role,
    membership: row.membership_id ? { id: row.membership_id, name: row.member_name } : null,
    businessParty: row.business_party_id
      ? { id: row.business_party_id, name: row.business_party_name }
      : null,
    businessPartyContact: row.business_party_contact_id
      ? { id: row.business_party_contact_id, name: row.contact_name }
      : null,
    addedBy: {
      membershipId: row.added_by_membership_id,
      name: row.added_by_name,
    },
    removedBy: row.removed_by_membership_id
      ? { membershipId: row.removed_by_membership_id, name: row.removed_by_name }
      : null,
    joinedAt: row.joined_at.toISOString(),
    leftAt: row.left_at?.toISOString() ?? null,
  };
}

function mapMessage(row: MessageRow): NegotiationMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    transportRequestId: row.transport_request_id,
    authorParticipantId: row.author_participant_id,
    authorName: row.author_name,
    kind: row.kind,
    body: row.body,
    relatedProposalId: row.related_proposal_id,
    replyToMessageId: row.reply_to_message_id,
    createdAt: row.created_at.toISOString(),
  };
}

function hasPgCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
