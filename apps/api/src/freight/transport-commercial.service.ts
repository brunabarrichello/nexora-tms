import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  appendCommercialHistory,
  changeCommercialStatus,
  createCommercialTerms,
  loadCommercialHistory,
  loadCommercialTerms,
  updateCommercialTerms,
} from './transport-commercial.persistence.js';
import {
  mapCommercialTerms,
  type CommercialHistoryView,
  type CommercialTermsView,
} from './transport-commercial.models.js';
import { parseCommercialStatus, parseCommercialTerms } from './transport-commercial.validation.js';
import { requireUuid, type TransportRequestStatus } from './transport-request.validation.js';

interface RequestRow {
  readonly status: TransportRequestStatus;
}

@Injectable()
export class TransportCommercialService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async getTerms(requestId: string): Promise<CommercialTermsView | null> {
    const id = requireUuid(requestId, 'requestId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireRequest(client, id);
      const row = await loadCommercialTerms(client, id);
      return row ? mapCommercialTerms(row) : null;
    });
  }

  async getHistory(requestId: string): Promise<CommercialHistoryView[]> {
    const id = requireUuid(requestId, 'requestId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireRequest(client, id);
      return loadCommercialHistory(client, id);
    });
  }

  async upsertTerms(requestId: string, input: unknown): Promise<CommercialTermsView> {
    const id = requireUuid(requestId, 'requestId');
    const terms = parseCommercialTerms(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const request = await this.requireRequest(client, id);
      this.requirePlanning(request.status);
      const current = await loadCommercialTerms(client, id);
      if (current?.status === 'pending_approval' || current?.status === 'approved') {
        throw new ConflictException(
          `Commercial terms cannot be edited while status is ${current.status}`,
        );
      }

      const saved = current
        ? await updateCommercialTerms(client, context.userId, id, current.version + 1, terms)
        : await createCommercialTerms(client, context.tenantId, context.userId, id, terms);
      await appendCommercialHistory(
        client,
        context.tenantId,
        context.userId,
        saved,
        current ? 'updated' : 'created',
        null,
      );
      return mapCommercialTerms(saved);
    });
  }

  async changeStatus(requestId: string, input: unknown): Promise<CommercialTermsView> {
    const id = requireUuid(requestId, 'requestId');
    const transition = parseCommercialStatus(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const request = await this.requireRequest(client, id);
      this.requirePlanning(request.status);
      const current = await loadCommercialTerms(client, id);
      if (!current) throw new NotFoundException('Commercial terms have not been defined');

      if (transition.status === 'pending_approval') {
        if (current.status !== 'draft' && current.status !== 'rejected') {
          throw new ConflictException(`Cannot submit commercial terms from ${current.status}`);
        }
      } else if (current.status !== 'pending_approval') {
        throw new ConflictException(
          `Commercial terms must be pending_approval before ${transition.status}`,
        );
      }

      const saved = await changeCommercialStatus(
        client,
        id,
        context.userId,
        transition.status,
        transition.note,
      );
      await appendCommercialHistory(
        client,
        context.tenantId,
        context.userId,
        saved,
        transition.status === 'pending_approval' ? 'submitted' : transition.status,
        transition.note,
      );
      return mapCommercialTerms(saved);
    });
  }

  private async requireRequest(client: TenantQueryClient, requestId: string): Promise<RequestRow> {
    const result = await client.query<RequestRow>(
      `SELECT status::text AS status FROM transport_requests WHERE id=$1::uuid`,
      [requestId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Transport request not found in current tenant');
    return row;
  }

  private requirePlanning(status: TransportRequestStatus): void {
    if (status !== 'draft' && status !== 'ready_for_quote') {
      throw new ConflictException(
        `Commercial terms cannot be changed while transport request status is ${status}`,
      );
    }
  }
}
