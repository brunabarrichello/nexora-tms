import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  receivableProjectionSql,
  receivableTransactionProjectionSql,
} from './finance-receivable.queries.js';
import type {
  CustomerReceivableEventRecord,
  CustomerReceivableRecord,
  CustomerReceivableTransactionRecord,
} from './finance-receivable.types.js';
import {
  parseCancelCustomerReceivable,
  parseCreateCustomerReceivable,
  parseCreateCustomerReceivableTransaction,
  parseUpdateCustomerReceivable,
  requireReceivableUuid,
} from './finance-receivable.validation.js';

@Injectable()
export class FinanceReceivableService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  listReceivables(): Promise<readonly CustomerReceivableRecord[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<CustomerReceivableRecord>(
        `${receivableProjectionSql()} ORDER BY rcv.due_at,rcv.created_at,rcv.id`,
      );
      return result.rows;
    });
  }

  async getReceivable(receivableIdValue: string): Promise<CustomerReceivableRecord> {
    const receivableId = requireReceivableUuid(receivableIdValue, 'receivableId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, (client) =>
      this.requireReceivable(client, receivableId),
    );
  }

  async createReceivable(input: unknown): Promise<CustomerReceivableRecord> {
    const payload = parseCreateCustomerReceivable(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      try {
        const result = await client.query<{ id: string }>(
          `INSERT INTO customer_receivables (
             tenant_id,transport_request_id,customer_party_id,currency_code,invoiced_amount,due_at,
             status,fiscal_document_id,fiscal_reference,notes,created_by_user_id,updated_by_user_id
           )
           SELECT $1::uuid,r.id,r.customer_party_id,terms.currency_code,$3::numeric(14,2),$4::timestamptz,
                  'open',$5::uuid,$6,$7,$8::uuid,$8::uuid
             FROM transport_requests r
             JOIN transport_request_commercial_terms terms
               ON terms.tenant_id=r.tenant_id AND terms.transport_request_id=r.id
            WHERE r.tenant_id=$1::uuid AND r.id=$2::uuid
           RETURNING id::text AS id`,
          [
            context.tenantId,
            payload.transportRequestId,
            payload.invoicedAmount,
            payload.dueAt,
            payload.fiscalDocumentId,
            payload.fiscalReference,
            payload.notes,
            context.userId,
          ],
        );
        const id = result.rows[0]?.id;
        if (!id) {
          throw new NotFoundException(
            'transport request with commercial terms not found in current tenant',
          );
        }
        return this.requireReceivable(client, id);
      } catch (error) {
        throwReceivableError(error);
      }
    });
  }

  async updateReceivable(
    receivableIdValue: string,
    input: unknown,
  ): Promise<CustomerReceivableRecord> {
    const receivableId = requireReceivableUuid(receivableIdValue, 'receivableId');
    const payload = parseUpdateCustomerReceivable(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const assignments: string[] = [];
      const values: unknown[] = [receivableId, context.userId];
      let parameter = 3;

      if (payload.dueAt !== undefined) {
        assignments.push(`due_at=$${parameter}::timestamptz`);
        values.push(payload.dueAt);
        parameter += 1;
      }
      if (payload.fiscalDocumentId !== undefined) {
        assignments.push(`fiscal_document_id=$${parameter}::uuid`);
        values.push(payload.fiscalDocumentId);
        parameter += 1;
      }
      if (payload.fiscalReference !== undefined) {
        assignments.push(`fiscal_reference=$${parameter}`);
        values.push(payload.fiscalReference);
        parameter += 1;
      }
      if (payload.notes !== undefined) {
        assignments.push(`notes=$${parameter}`);
        values.push(payload.notes);
        parameter += 1;
      }
      assignments.push('updated_by_user_id=$2::uuid');

      try {
        const result = await client.query<{ id: string }>(
          `UPDATE customer_receivables
              SET ${assignments.join(',')}
            WHERE id=$1::uuid
            RETURNING id::text AS id`,
          values,
        );
        const id = result.rows[0]?.id;
        if (!id) throw new NotFoundException('customer receivable not found in current tenant');
        return this.requireReceivable(client, id);
      } catch (error) {
        throwReceivableError(error);
      }
    });
  }

  async cancelReceivable(
    receivableIdValue: string,
    input: unknown,
  ): Promise<CustomerReceivableRecord> {
    const receivableId = requireReceivableUuid(receivableIdValue, 'receivableId');
    const payload = parseCancelCustomerReceivable(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      try {
        const result = await client.query<{ id: string }>(
          `UPDATE customer_receivables
              SET status='cancelled',cancel_reason=$2,cancelled_at=now(),cancelled_by_user_id=$3::uuid,
                  updated_by_user_id=$3::uuid
            WHERE id=$1::uuid AND status <> 'cancelled'
            RETURNING id::text AS id`,
          [receivableId, payload.reason, context.userId],
        );
        const id = result.rows[0]?.id;
        if (!id) {
          const existing = await client.query<{ status: string }>(
            'SELECT status FROM customer_receivables WHERE id=$1::uuid',
            [receivableId],
          );
          if (existing.rows[0]?.status === 'cancelled') {
            throw new ConflictException('customer receivable is already cancelled');
          }
          throw new NotFoundException('customer receivable not found in current tenant');
        }
        return this.requireReceivable(client, id);
      } catch (error) {
        throwReceivableError(error);
      }
    });
  }

  async listTransactions(
    receivableIdValue: string,
  ): Promise<readonly CustomerReceivableTransactionRecord[]> {
    const receivableId = requireReceivableUuid(receivableIdValue, 'receivableId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireReceivable(client, receivableId);
      const result = await client.query<CustomerReceivableTransactionRecord>(
        receivableTransactionProjectionSql(
          'WHERE t.receivable_id=$1::uuid ORDER BY t.occurred_at,t.created_at,t.id',
        ),
        [receivableId],
      );
      return result.rows;
    });
  }

  async createTransaction(
    receivableIdValue: string,
    input: unknown,
  ): Promise<CustomerReceivableTransactionRecord> {
    const receivableId = requireReceivableUuid(receivableIdValue, 'receivableId');
    const payload = parseCreateCustomerReceivableTransaction(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireReceivable(client, receivableId);
      try {
        const result = await client.query<{ id: string }>(
          `INSERT INTO customer_receivable_transactions (
             tenant_id,receivable_id,kind,amount,related_transaction_id,proof_document_id,
             occurred_at,notes,created_by_user_id
           ) VALUES ($1::uuid,$2::uuid,$3,$4::numeric(14,2),$5::uuid,$6::uuid,$7::timestamptz,$8,$9::uuid)
           RETURNING id::text AS id`,
          [
            context.tenantId,
            receivableId,
            payload.kind,
            payload.amount,
            payload.relatedTransactionId,
            payload.proofDocumentId,
            payload.occurredAt,
            payload.notes,
            context.userId,
          ],
        );
        const id = result.rows[0]?.id;
        if (!id)
          throw new ConflictException('customer receivable transaction could not be persisted');
        return this.requireTransaction(client, id);
      } catch (error) {
        throwReceivableError(error);
      }
    });
  }

  async listEvents(receivableIdValue: string): Promise<readonly CustomerReceivableEventRecord[]> {
    const receivableId = requireReceivableUuid(receivableIdValue, 'receivableId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireReceivable(client, receivableId);
      const result = await client.query<CustomerReceivableEventRecord>(
        `SELECT id::text AS id,receivable_id::text AS "receivableId",event_type AS "eventType",
                payload,actor_user_id::text AS "actorUserId",created_at AS "createdAt"
           FROM customer_receivable_events
          WHERE receivable_id=$1::uuid
          ORDER BY created_at,id`,
        [receivableId],
      );
      return result.rows;
    });
  }

  private async requireReceivable(
    client: TenantQueryClient,
    receivableId: string,
  ): Promise<CustomerReceivableRecord> {
    const result = await client.query<CustomerReceivableRecord>(
      `${receivableProjectionSql()} AND rcv.id=$1::uuid LIMIT 1`,
      [receivableId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('customer receivable not found in current tenant');
    return row;
  }

  private async requireTransaction(
    client: TenantQueryClient,
    transactionId: string,
  ): Promise<CustomerReceivableTransactionRecord> {
    const result = await client.query<CustomerReceivableTransactionRecord>(
      receivableTransactionProjectionSql('WHERE t.id=$1::uuid LIMIT 1'),
      [transactionId],
    );
    const row = result.rows[0];
    if (!row)
      throw new NotFoundException('customer receivable transaction not found in current tenant');
    return row;
  }
}

function throwReceivableError(error: unknown): never {
  if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
  const candidate = error as { code?: string; message?: string };
  if (candidate?.code === '23505') {
    throw new ConflictException('customer receivable record already exists');
  }
  if (candidate?.code === 'P0001' || candidate?.code === '23503' || candidate?.code === '23514') {
    throw new ConflictException(
      candidate.message ?? 'customer receivable rule rejected the operation',
    );
  }
  throw error;
}
