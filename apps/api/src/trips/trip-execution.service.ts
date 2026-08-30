import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  parseTripCheckin,
  parseTripChecklist,
  parseTripChecklistStatus,
  parseTripDeliveryProof,
  parseTripDocument,
  parseTripEvent,
  parseTripExpense,
  parseTripExpenseStatus,
  parseTripFuel,
  parseTripLocation,
  parseTripProof,
  parseTripToll,
} from './trip-execution.validation.js';

type ExecutionTable =
  | 'trip_events'
  | 'trip_checkins'
  | 'trip_locations'
  | 'trip_checklists'
  | 'trip_documents'
  | 'trip_expenses'
  | 'trip_tolls'
  | 'trip_fuel'
  | 'trip_proofs'
  | 'trip_delivery_proofs';

interface TripStateRow {
  readonly id: string;
  readonly status: 'planned' | 'ready' | 'in_transit' | 'completed' | 'cancelled';
}

interface StopStateRow {
  readonly id: string;
  readonly type: string;
  readonly status: 'planned' | 'arrived' | 'departed' | 'skipped' | 'cancelled';
  readonly actual_arrival_at: Date | null;
  readonly actual_departure_at: Date | null;
}

@Injectable()
export class TripExecutionService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  listEvents(tripId: string) {
    return this.list(tripId, 'trip_events', 'occurred_at,created_at');
  }

  async createEvent(tripId: string, input: unknown): Promise<Record<string, unknown>> {
    const event = parseTripEvent(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireOperationalTrip(client, tripId, false);
      if (event.tripStopId) await this.requireStop(client, trip.id, event.tripStopId, false);
      return this.insertOne(
        client,
        `INSERT INTO trip_events (
           tenant_id,trip_id,trip_stop_id,event_type,source,title,description,occurred_at,actor_user_id,metadata
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::timestamptz,$9::uuid,$10::jsonb)
         RETURNING *`,
        [
          context.tenantId,
          trip.id,
          event.tripStopId,
          event.eventType,
          event.source,
          event.title,
          event.description,
          event.occurredAt,
          context.userId,
          JSON.stringify(event.metadata),
        ],
      );
    });
  }

  listCheckins(tripId: string) {
    return this.list(tripId, 'trip_checkins', 'occurred_at,created_at');
  }

  async createCheckin(tripId: string, input: unknown): Promise<Record<string, unknown>> {
    const checkin = parseTripCheckin(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireOperationalTrip(client, tripId, true);
      const stop = await this.requireStop(client, trip.id, checkin.tripStopId, true);
      if (stop.status === 'cancelled' || stop.status === 'skipped') {
        throw new ConflictException(`Cannot check in at a ${stop.status} stop`);
      }
      if (checkin.checkinType === 'departure' && !stop.actual_arrival_at) {
        throw new ConflictException('Arrival must be recorded before departure');
      }

      const created = await this.insertOne(
        client,
        `INSERT INTO trip_checkins (
           tenant_id,trip_id,trip_stop_id,checkin_type,source,occurred_at,latitude,longitude,notes,actor_user_id
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::timestamptz,$7,$8,$9,$10::uuid)
         RETURNING *`,
        [
          context.tenantId,
          trip.id,
          stop.id,
          checkin.checkinType,
          checkin.source,
          checkin.occurredAt,
          checkin.latitude,
          checkin.longitude,
          checkin.notes,
          context.userId,
        ],
      );

      await this.applyStopMilestone(
        client,
        stop,
        checkin.checkinType,
        checkin.occurredAt,
        context.userId,
      );
      await client.query(
        `INSERT INTO trip_events (
           tenant_id,trip_id,trip_stop_id,event_type,source,title,description,occurred_at,actor_user_id,metadata
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::timestamptz,$9::uuid,'{}'::jsonb)`,
        [
          context.tenantId,
          trip.id,
          stop.id,
          checkin.checkinType,
          checkin.source === 'gps' ? 'integration' : checkin.source,
          `Stop ${checkin.checkinType}`,
          checkin.notes,
          checkin.occurredAt,
          context.userId,
        ],
      );

      if (trip.status === 'ready' && ['departure', 'pickup'].includes(checkin.checkinType)) {
        await client.query(
          `UPDATE trips
              SET status='in_transit',actual_start_at=coalesce(actual_start_at,$1::timestamptz),
                  updated_by_user_id=$2::uuid,updated_at=now()
            WHERE id=$3::uuid AND status='ready'`,
          [checkin.occurredAt, context.userId, trip.id],
        );
        await client.query(
          `INSERT INTO trip_status_history (
             tenant_id,trip_id,from_status,to_status,actor_user_id,reason
           ) VALUES ($1::uuid,$2::uuid,'ready','in_transit',$3::uuid,'Started by execution milestone')`,
          [context.tenantId, trip.id, context.userId],
        );
      }

      return created;
    });
  }

  listLocations(tripId: string) {
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

  listChecklists(tripId: string) {
    return this.list(tripId, 'trip_checklists', 'created_at');
  }

  async createChecklist(tripId: string, input: unknown): Promise<Record<string, unknown>> {
    const item = parseTripChecklist(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireNonTerminalTrip(client, tripId, false);
      if (item.tripStopId) await this.requireStop(client, trip.id, item.tripStopId, false);
      return this.insertOne(
        client,
        `INSERT INTO trip_checklists (
           tenant_id,trip_id,trip_stop_id,category,item_code,label,required,notes,created_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9::uuid)
         RETURNING *`,
        [
          context.tenantId,
          trip.id,
          item.tripStopId,
          item.category,
          item.itemCode,
          item.label,
          item.required,
          item.notes,
          context.userId,
        ],
      );
    });
  }

  async setChecklistStatus(
    tripId: string,
    checklistId: string,
    input: unknown,
  ): Promise<Record<string, unknown>> {
    const id = requireUuid(checklistId, 'checklistId');
    const transition = parseTripChecklistStatus(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireNonTerminalTrip(client, tripId, false);
      const result = await client.query<Record<string, unknown>>(
        `UPDATE trip_checklists
            SET status=$1,completed_at=now(),completed_by_user_id=$2::uuid,
                waiver_reason=$3,notes=coalesce($4,notes),updated_at=now()
          WHERE id=$5::uuid AND trip_id=$6::uuid AND status='pending'
          RETURNING *`,
        [transition.status, context.userId, transition.waiverReason, transition.notes, id, trip.id],
      );
      const row = result.rows[0];
      if (!row) throw new ConflictException('Checklist item is missing or already finalized');
      return row;
    });
  }

  listDocuments(tripId: string) {
    return this.list(tripId, 'trip_documents', 'created_at');
  }

  async linkDocument(tripId: string, input: unknown): Promise<Record<string, unknown>> {
    const link = parseTripDocument(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireNonTerminalTrip(client, tripId, false);
      if (link.tripStopId) await this.requireStop(client, trip.id, link.tripStopId, false);
      const document = await client.query(
        `SELECT 1 FROM documents WHERE id=$1::uuid AND deleted_at IS NULL`,
        [link.documentId],
      );
      if (document.rowCount !== 1)
        throw new NotFoundException('Document not found in current tenant');
      try {
        return await this.insertOne(
          client,
          `INSERT INTO trip_documents (
             tenant_id,trip_id,trip_stop_id,document_id,relation_type,created_by_user_id
           ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::uuid)
           RETURNING *`,
          [
            context.tenantId,
            trip.id,
            link.tripStopId,
            link.documentId,
            link.relationType,
            context.userId,
          ],
        );
      } catch (error) {
        if (hasPgCode(error, '23505'))
          throw new ConflictException('Document is already linked to this trip');
        throw error;
      }
    });
  }

  listExpenses(tripId: string) {
    return this.list(tripId, 'trip_expenses', 'incurred_at,created_at');
  }

  async createExpense(tripId: string, input: unknown): Promise<Record<string, unknown>> {
    const expense = parseTripExpense(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireNotCancelledTrip(client, tripId, false);
      await this.requireOptionalReferences(
        client,
        trip.id,
        expense.tripStopId,
        expense.tripDocumentId,
      );
      return this.insertOne(
        client,
        `INSERT INTO trip_expenses (
           tenant_id,trip_id,trip_stop_id,trip_document_id,category,amount,currency_id,incurred_at,
           merchant,external_reference,description,reported_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7::uuid,$8::timestamptz,$9,$10,$11,$12::uuid)
         RETURNING *`,
        [
          context.tenantId,
          trip.id,
          expense.tripStopId,
          expense.tripDocumentId,
          expense.category,
          expense.amount,
          expense.currencyId,
          expense.incurredAt,
          expense.merchant,
          expense.externalReference,
          expense.description,
          context.userId,
        ],
      );
    });
  }

  async setExpenseStatus(
    tripId: string,
    expenseId: string,
    input: unknown,
  ): Promise<Record<string, unknown>> {
    const id = requireUuid(expenseId, 'expenseId');
    const transition = parseTripExpenseStatus(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireNotCancelledTrip(client, tripId, false);
      const result = await client.query<Record<string, unknown>>(
        `UPDATE trip_expenses
            SET status=$1,reviewed_by_user_id=$2::uuid,reviewed_at=now(),review_reason=$3,updated_at=now()
          WHERE id=$4::uuid AND trip_id=$5::uuid AND status='reported'
          RETURNING *`,
        [transition.status, context.userId, transition.reason, id, trip.id],
      );
      const row = result.rows[0];
      if (!row) throw new ConflictException('Expense is missing or already reviewed');
      return row;
    });
  }

  listTolls(tripId: string) {
    return this.list(tripId, 'trip_tolls', 'occurred_at,created_at');
  }

  async createToll(tripId: string, input: unknown): Promise<Record<string, unknown>> {
    const toll = parseTripToll(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireNotCancelledTrip(client, tripId, false);
      await this.requireOptionalReferences(client, trip.id, toll.tripStopId, toll.tripDocumentId);
      return this.insertOne(
        client,
        `INSERT INTO trip_tolls (
           tenant_id,trip_id,trip_stop_id,trip_document_id,plaza,road,amount,currency_id,
           occurred_at,payment_method,tag_reference,notes,created_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8::uuid,$9::timestamptz,$10,$11,$12,$13::uuid)
         RETURNING *`,
        [
          context.tenantId,
          trip.id,
          toll.tripStopId,
          toll.tripDocumentId,
          toll.plaza,
          toll.road,
          toll.amount,
          toll.currencyId,
          toll.occurredAt,
          toll.paymentMethod,
          toll.tagReference,
          toll.notes,
          context.userId,
        ],
      );
    });
  }

  listFuel(tripId: string) {
    return this.list(tripId, 'trip_fuel', 'fueled_at,created_at');
  }

  async createFuel(tripId: string, input: unknown): Promise<Record<string, unknown>> {
    const fuel = parseTripFuel(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireNotCancelledTrip(client, tripId, false);
      await this.requireOptionalReferences(client, trip.id, fuel.tripStopId, fuel.tripDocumentId);
      return this.insertOne(
        client,
        `INSERT INTO trip_fuel (
           tenant_id,trip_id,trip_stop_id,trip_document_id,fuel_type,liters,unit_price,total_amount,
           currency_id,odometer_km,station,fueled_at,notes,created_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9::uuid,$10,$11,$12::timestamptz,$13,$14::uuid)
         RETURNING *`,
        [
          context.tenantId,
          trip.id,
          fuel.tripStopId,
          fuel.tripDocumentId,
          fuel.fuelType,
          fuel.liters,
          fuel.unitPrice,
          fuel.totalAmount,
          fuel.currencyId,
          fuel.odometerKm,
          fuel.station,
          fuel.fueledAt,
          fuel.notes,
          context.userId,
        ],
      );
    });
  }

  listProofs(tripId: string) {
    return this.list(tripId, 'trip_proofs', 'captured_at,created_at');
  }

  async createProof(tripId: string, input: unknown): Promise<Record<string, unknown>> {
    const proof = parseTripProof(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireNonTerminalTrip(client, tripId, false);
      if (proof.tripStopId) await this.requireStop(client, trip.id, proof.tripStopId, false);
      await this.requireTripDocument(client, trip.id, proof.tripDocumentId);
      return this.insertOne(
        client,
        `INSERT INTO trip_proofs (
           tenant_id,trip_id,trip_stop_id,trip_document_id,proof_type,captured_at,captured_by_user_id,
           source,notes,metadata
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::timestamptz,$7::uuid,$8,$9,$10::jsonb)
         RETURNING *`,
        [
          context.tenantId,
          trip.id,
          proof.tripStopId,
          proof.tripDocumentId,
          proof.proofType,
          proof.capturedAt,
          context.userId,
          proof.source,
          proof.notes,
          JSON.stringify(proof.metadata),
        ],
      );
    });
  }

  listDeliveryProofs(tripId: string) {
    return this.list(tripId, 'trip_delivery_proofs', 'delivered_at,created_at');
  }

  async createDeliveryProof(tripId: string, input: unknown): Promise<Record<string, unknown>> {
    const delivery = parseTripDeliveryProof(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireNonTerminalTrip(client, tripId, false);
      const stop = await this.requireStop(client, trip.id, delivery.tripStopId, false);
      if (stop.type !== 'delivery')
        throw new ConflictException('Delivery proof requires a delivery stop');
      const proof = await client.query<{ proof_type: string; trip_stop_id: string | null }>(
        `SELECT proof_type,trip_stop_id::text AS trip_stop_id
           FROM trip_proofs
          WHERE id=$1::uuid AND trip_id=$2::uuid`,
        [delivery.tripProofId, trip.id],
      );
      const proofRow = proof.rows[0];
      if (!proofRow || proofRow.proof_type !== 'delivery') {
        throw new ConflictException('Delivery proof requires an existing delivery trip proof');
      }
      if (proofRow.trip_stop_id && proofRow.trip_stop_id !== stop.id) {
        throw new ConflictException('Delivery proof and trip proof must refer to the same stop');
      }
      return this.insertOne(
        client,
        `INSERT INTO trip_delivery_proofs (
           tenant_id,trip_id,trip_stop_id,trip_proof_id,received_by_name,received_by_role,
           delivered_at,status,exception_reason,created_by_user_id
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7::timestamptz,$8,$9,$10::uuid)
         RETURNING *`,
        [
          context.tenantId,
          trip.id,
          stop.id,
          delivery.tripProofId,
          delivery.receivedByName,
          delivery.receivedByRole,
          delivery.deliveredAt,
          delivery.status,
          delivery.exceptionReason,
          context.userId,
        ],
      );
    });
  }

  private async list(
    tripId: string,
    table: ExecutionTable,
    order: string,
  ): Promise<readonly Record<string, unknown>[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireTrip(client, tripId, false);
      const result = await client.query<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE trip_id=$1::uuid ORDER BY ${order}`,
        [trip.id],
      );
      return result.rows;
    });
  }

  private async requireTrip(
    client: TenantQueryClient,
    tripId: string,
    forUpdate: boolean,
  ): Promise<TripStateRow> {
    const id = requireUuid(tripId, 'tripId');
    const result = await client.query<TripStateRow>(
      `SELECT id::text AS id,status::text AS status FROM trips WHERE id=$1::uuid${forUpdate ? ' FOR UPDATE' : ''}`,
      [id],
    );
    const trip = result.rows[0];
    if (!trip) throw new NotFoundException('Trip not found in current tenant');
    return trip;
  }

  private async requireOperationalTrip(
    client: TenantQueryClient,
    tripId: string,
    forUpdate: boolean,
  ): Promise<TripStateRow> {
    const trip = await this.requireTrip(client, tripId, forUpdate);
    if (trip.status !== 'ready' && trip.status !== 'in_transit') {
      throw new ConflictException(`Trip execution is not allowed while status is ${trip.status}`);
    }
    return trip;
  }

  private async requireNonTerminalTrip(
    client: TenantQueryClient,
    tripId: string,
    forUpdate: boolean,
  ): Promise<TripStateRow> {
    const trip = await this.requireTrip(client, tripId, forUpdate);
    if (trip.status === 'completed' || trip.status === 'cancelled') {
      throw new ConflictException(`Trip is already ${trip.status}`);
    }
    return trip;
  }

  private async requireNotCancelledTrip(
    client: TenantQueryClient,
    tripId: string,
    forUpdate: boolean,
  ): Promise<TripStateRow> {
    const trip = await this.requireTrip(client, tripId, forUpdate);
    if (trip.status === 'cancelled')
      throw new ConflictException('Cancelled trip cannot receive execution data');
    return trip;
  }

  private async requireStop(
    client: TenantQueryClient,
    tripId: string,
    stopId: string,
    forUpdate: boolean,
  ): Promise<StopStateRow> {
    const id = requireUuid(stopId, 'tripStopId');
    const result = await client.query<StopStateRow>(
      `SELECT id::text AS id,type::text AS type,status::text AS status,actual_arrival_at,actual_departure_at
         FROM trip_stops
        WHERE id=$1::uuid AND trip_id=$2::uuid${forUpdate ? ' FOR UPDATE' : ''}`,
      [id, tripId],
    );
    const stop = result.rows[0];
    if (!stop) throw new NotFoundException('Trip stop not found in current trip');
    return stop;
  }

  private async requireTripDocument(
    client: TenantQueryClient,
    tripId: string,
    tripDocumentId: string,
  ): Promise<void> {
    const result = await client.query(
      `SELECT 1 FROM trip_documents WHERE id=$1::uuid AND trip_id=$2::uuid`,
      [tripDocumentId, tripId],
    );
    if (result.rowCount !== 1) throw new NotFoundException('Trip document link not found');
  }

  private async requireOptionalReferences(
    client: TenantQueryClient,
    tripId: string,
    stopId: string | null,
    tripDocumentId: string | null,
  ): Promise<void> {
    if (stopId) await this.requireStop(client, tripId, stopId, false);
    if (tripDocumentId) await this.requireTripDocument(client, tripId, tripDocumentId);
  }

  private async applyStopMilestone(
    client: TenantQueryClient,
    stop: StopStateRow,
    type: string,
    occurredAt: string,
    userId: string,
  ): Promise<void> {
    if (type === 'checkpoint') return;
    if (type === 'arrival') {
      await client.query(
        `UPDATE trip_stops
            SET actual_arrival_at=coalesce(actual_arrival_at,$1::timestamptz),
                status=CASE WHEN status='planned' THEN 'arrived'::trip_stop_status ELSE status END,
                updated_by_user_id=$2::uuid,updated_at=now()
          WHERE id=$3::uuid`,
        [occurredAt, userId, stop.id],
      );
      return;
    }
    if (type === 'departure') {
      await client.query(
        `UPDATE trip_stops
            SET actual_departure_at=coalesce(actual_departure_at,$1::timestamptz),
                status='departed',updated_by_user_id=$2::uuid,updated_at=now()
          WHERE id=$3::uuid`,
        [occurredAt, userId, stop.id],
      );
      return;
    }
    await client.query(
      `UPDATE trip_stops
          SET actual_arrival_at=coalesce(actual_arrival_at,$1::timestamptz),
              actual_departure_at=coalesce(actual_departure_at,$1::timestamptz),
              status='departed',updated_by_user_id=$2::uuid,updated_at=now()
        WHERE id=$3::uuid`,
      [occurredAt, userId, stop.id],
    );
  }

  private async insertOne(
    client: TenantQueryClient,
    sql: string,
    params: readonly unknown[],
  ): Promise<Record<string, unknown>> {
    const result = await client.query<Record<string, unknown>>(sql, [...params]);
    const row = result.rows[0];
    if (!row) throw new ConflictException('Execution record could not be created');
    return row;
  }
}

function hasPgCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === code,
  );
}
