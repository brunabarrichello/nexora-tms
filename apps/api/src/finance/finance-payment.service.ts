import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import { obligationProjectionSql, transactionProjectionSql } from './finance-payment.queries.js';
import {
  parseCancelCarrierPaymentObligation,
  parseCreateCarrierPaymentObligation,
  parseCreateCarrierPaymentTransaction,
  parseUpdateCarrierPaymentObligation,
  requireFinanceUuid,
} from './finance-payment.validation.js';
import type {
  CarrierPaymentEventRecord,
  CarrierPaymentObligationRecord,
  CarrierPaymentTransactionRecord,
} from './finance-payment.types.js';

@Injectable()
export class FinancePaymentService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  listObligations(): Promise<readonly CarrierPaymentObligationRecord[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const result = await client.query<CarrierPaymentObligationRecord>(
        `${obligationProjectionSql()} ORDER BY o.due_at,o.created_at,o.id`,
      );
      return result.rows;
    });
  }

  async getObligation(obligationIdValue: string): Promise<CarrierPaymentObligationRecord> {
    const obligationId = requireFinanceUuid(obligationIdValue, 'obligationId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, (client) =>
      this.requireObligation(client, obligationId),
    );
  }

  async createObligation(input: unknown): Promise<CarrierPaymentObligationRecord> {
    const payload = parseCreateCarrierPaymentObligation(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      try {
        const result = await client.query<{ id: string }>(
          `INSERT INTO carrier_payment_obligations (
             tenant_id,transport_request_id,transport_contract_id,trip_id,carrier_party_id,currency_code,
             contracted_amount,due_at,status,notes,created_by_user_id,updated_by_user_id
           )
           SELECT $1::uuid,c.transport_request_id,c.id,$3::uuid,c.carrier_party_id,c.currency_code,
                  (c.freight_amount+c.toll_amount+c.additional_amount)::numeric(14,2),
                  $4::timestamptz,'open',$5,$6::uuid,$6::uuid
             FROM transport_contracts c
            WHERE c.id=$2::uuid AND c.status IN ('confirmed','fulfilled')
           RETURNING id::text AS id`,
          [
            context.tenantId,
            payload.transportContractId,
            payload.tripId,
            payload.dueAt,
            payload.notes,
            context.userId,
          ],
        );
        const id = result.rows[0]?.id;
        if (!id) {
          throw new NotFoundException(
            'confirmed or fulfilled transport contract not found in current tenant',
          );
        }
        return this.requireObligation(client, id);
      } catch (error) {
        throwPaymentError(error);
      }
    });
  }

  async updateObligation(
    obligationIdValue: string,
    input: unknown,
  ): Promise<CarrierPaymentObligationRecord> {
    const obligationId = requireFinanceUuid(obligationIdValue, 'obligationId');
    const payload = parseUpdateCarrierPaymentObligation(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const assignments: string[] = [];
      const values: unknown[] = [obligationId, context.userId];
      let parameter = 3;

      if (payload.dueAt !== undefined) {
        assignments.push(`due_at=$${parameter}::timestamptz`);
        values.push(payload.dueAt);
        parameter += 1;
      }
      if (payload.tripId !== undefined) {
        assignments.push(`trip_id=$${parameter}::uuid`);
        values.push(payload.tripId);
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
          `UPDATE carrier_payment_obligations
              SET ${assignments.join(',')}
            WHERE id=$1::uuid
            RETURNING id::text AS id`,
          values,
        );
        const id = result.rows[0]?.id;
        if (!id)
          throw new NotFoundException('carrier payment obligation not found in current tenant');
        return this.requireObligation(client, id);
      } catch (error) {
        throwPaymentError(error);
      }
    });
  }

  async cancelObligation(
    obligationIdValue: string,
    input: unknown,
  ): Promise<CarrierPaymentObligationRecord> {
    const obligationId = requireFinanceUuid(obligationIdValue, 'obligationId');
    const payload = parseCancelCarrierPaymentObligation(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      try {
        const result = await client.query<{ id: string }>(
          `UPDATE carrier_payment_obligations
              SET status='cancelled',cancel_reason=$2,cancelled_at=now(),cancelled_by_user_id=$3::uuid,
                  updated_by_user_id=$3::uuid
            WHERE id=$1::uuid AND status <> 'cancelled'
            RETURNING id::text AS id`,
          [obligationId, payload.reason, context.userId],
        );
        const id = result.rows[0]?.id;
        if (!id) {
          const existing = await client.query<{ status: string }>(
            'SELECT status FROM carrier_payment_obligations WHERE id=$1::uuid',
            [obligationId],
          );
          if (existing.rows[0]?.status === 'cancelled') {
            throw new ConflictException('carrier payment obligation is already cancelled');
          }
          throw new NotFoundException('carrier payment obligation not found in current tenant');
        }
        return this.requireObligation(client, id);
      } catch (error) {
        throwPaymentError(error);
      }
    });
  }

  async listTransactions(
    obligationIdValue: string,
  ): Promise<readonly CarrierPaymentTransactionRecord[]> {
    const obligationId = requireFinanceUuid(obligationIdValue, 'obligationId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireObligation(client, obligationId);
      const result = await client.query<CarrierPaymentTransactionRecord>(
        transactionProjectionSql(
          'WHERE t.obligation_id=$1::uuid ORDER BY t.occurred_at,t.created_at,t.id',
        ),
        [obligationId],
      );
      return result.rows;
    });
  }

  async createTransaction(
    obligationIdValue: string,
    input: unknown,
  ): Promise<CarrierPaymentTransactionRecord> {
    const obligationId = requireFinanceUuid(obligationIdValue, 'obligationId');
    const payload = parseCreateCarrierPaymentTransaction(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      await this.requireObligation(client, obligationId);
      if (payload.proofDocumentId) {
        const proof = await client.query<{ id: string }>(
          'SELECT id::text AS id FROM documents WHERE id=$1::uuid AND deleted_at IS NULL',
          [payload.proofDocumentId],
        );
        if (!proof.rows[0])
          throw new NotFoundException('proof document not found in current tenant');
      }

      try {
        const result = await client.query<{ id: string }>(
          `INSERT INTO carrier_payment_transactions (
             tenant_id,obligation_id,kind,amount,related_transaction_id,proof_document_id,
             occurred_at,notes,created_by_user_id
           ) VALUES ($1::uuid,$2::uuid,$3,$4::numeric(14,2),$5::uuid,$6::uuid,$7::timestamptz,$8,$9::uuid)
           RETURNING id::text AS id`,
          [
            context.tenantId,
            obligationId,
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
        if (!id) throw new ConflictException('carrier payment transaction could not be persisted');
        return this.requireTransaction(client, id);
      } catch (error) {
        throwPaymentError(error);
      }
    });
  }

  async listEvents(obligationIdValue: string): Promise<readonly CarrierPaymentEventRecord[]> {
    const obligationId = requireFinanceUuid(obligationIdValue, 'obligationId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireObligation(client, obligationId);
      const result = await client.query<CarrierPaymentEventRecord>(
        `SELECT id::text AS id,obligation_id::text AS "obligationId",event_type AS "eventType",
                payload,actor_user_id::text AS "actorUserId",created_at AS "createdAt"
           FROM carrier_payment_events
          WHERE obligation_id=$1::uuid
          ORDER BY created_at,id`,
        [obligationId],
      );
      return result.rows;
    });
  }

  private async requireObligation(
    client: TenantQueryClient,
    obligationId: string,
  ): Promise<CarrierPaymentObligationRecord> {
    const result = await client.query<CarrierPaymentObligationRecord>(
      `${obligationProjectionSql()} AND o.id=$1::uuid LIMIT 1`,
      [obligationId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('carrier payment obligation not found in current tenant');
    return row;
  }

  private async requireTransaction(
    client: TenantQueryClient,
    transactionId: string,
  ): Promise<CarrierPaymentTransactionRecord> {
    const result = await client.query<CarrierPaymentTransactionRecord>(
      transactionProjectionSql('WHERE t.id=$1::uuid LIMIT 1'),
      [transactionId],
    );
    const row = result.rows[0];
    if (!row)
      throw new NotFoundException('carrier payment transaction not found in current tenant');
    return row;
  }
}

function throwPaymentError(error: unknown): never {
  if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
  const candidate = error as { code?: string; message?: string };
  if (candidate?.code === '23505') {
    throw new ConflictException('carrier payment record already exists');
  }
  if (candidate?.code === 'P0001' || candidate?.code === '23503' || candidate?.code === '23514') {
    throw new ConflictException(candidate.message ?? 'carrier payment rule rejected the operation');
  }
  throw error;
}
