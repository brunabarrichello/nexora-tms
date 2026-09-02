import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { requireUuid } from '../freight/transport-request.validation.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  parseTripOccurrence,
  parseTripOccurrenceDocument,
  parseTripOccurrenceStatus,
  parseTripOccurrenceTreatment,
  type TripOccurrenceStatus,
} from './trip-occurrence.validation.js';

type TripStatus = 'planned' | 'ready' | 'in_transit' | 'completed' | 'cancelled';

interface TripStateRow {
  readonly id: string;
  readonly status: TripStatus;
}

interface OccurrenceStateRow {
  readonly id: string;
  readonly status: TripOccurrenceStatus;
  readonly responsible_user_id: string | null;
}

@Injectable()
export class TripOccurrenceService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async list(tripId: string): Promise<readonly Record<string, unknown>[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireTrip(client, tripId, false);
      const result = await client.query<Record<string, unknown>>(
        `SELECT *
           FROM trip_occurrences
          WHERE trip_id=$1::uuid
          ORDER BY occurred_at DESC, created_at DESC`,
        [trip.id],
      );
      return result.rows;
    });
  }

  async get(tripId: string, occurrenceId: string): Promise<Record<string, unknown>> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireTrip(client, tripId, false);
      const id = requireUuid(occurrenceId, 'occurrenceId');
      await this.requireOccurrence(client, trip.id, id, false);
      const result = await client.query<Record<string, unknown>>(
        `SELECT * FROM trip_occurrences WHERE id=$1::uuid AND trip_id=$2::uuid`,
        [id, trip.id],
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException('Occurrence not found in current trip');
      return row;
    });
  }

  async create(tripId: string, input: unknown): Promise<Record<string, unknown>> {
    const occurrence = parseTripOccurrence(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireOperationalTrip(client, tripId, false);
      if (occurrence.tripStopId) {
        await this.requireStop(client, trip.id, occurrence.tripStopId);
      }
      if (occurrence.responsibleUserId) {
        await this.requireActiveResponsible(client, occurrence.responsibleUserId);
      }

      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO trip_occurrences (
           tenant_id,trip_id,trip_stop_id,occurrence_type,severity,status,occurred_at,
           latitude,longitude,location_text,description,responsible_user_id,created_by_user_id
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4,$5,'open',$6::timestamptz,
           $7,$8,$9,$10,$11::uuid,$12::uuid
         )
         RETURNING *`,
        [
          context.tenantId,
          trip.id,
          occurrence.tripStopId,
          occurrence.occurrenceType,
          occurrence.severity,
          occurrence.occurredAt,
          occurrence.latitude,
          occurrence.longitude,
          occurrence.locationText,
          occurrence.description,
          occurrence.responsibleUserId,
          context.userId,
        ],
      );
      const row = inserted.rows[0];
      if (!row) throw new ConflictException('Occurrence could not be created');

      await client.query(
        `INSERT INTO trip_occurrence_history (
           tenant_id,occurrence_id,action,from_status,to_status,responsible_user_id,note,actor_user_id
         ) VALUES ($1::uuid,$2::uuid,'created',NULL,'open',$3::uuid,NULL,$4::uuid)`,
        [context.tenantId, row.id, occurrence.responsibleUserId, context.userId],
      );
      return row;
    });
  }

  async listHistory(
    tripId: string,
    occurrenceId: string,
  ): Promise<readonly Record<string, unknown>[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireTrip(client, tripId, false);
      const id = requireUuid(occurrenceId, 'occurrenceId');
      await this.requireOccurrence(client, trip.id, id, false);
      const result = await client.query<Record<string, unknown>>(
        `SELECT *
           FROM trip_occurrence_history
          WHERE occurrence_id=$1::uuid
          ORDER BY created_at,id`,
        [id],
      );
      return result.rows;
    });
  }

  async addTreatment(
    tripId: string,
    occurrenceId: string,
    input: unknown,
  ): Promise<Record<string, unknown>> {
    const treatment = parseTripOccurrenceTreatment(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireTrip(client, tripId, false);
      const id = requireUuid(occurrenceId, 'occurrenceId');
      const current = await this.requireOccurrence(client, trip.id, id, true);

      if (treatment.changesResponsible && treatment.responsibleUserId) {
        await this.requireActiveResponsible(client, treatment.responsibleUserId);
      }

      const responsible = treatment.changesResponsible
        ? treatment.responsibleUserId
        : current.responsible_user_id;
      const updated = treatment.changesResponsible
        ? await client.query<Record<string, unknown>>(
            `UPDATE trip_occurrences
                SET responsible_user_id=$1::uuid,updated_at=now()
              WHERE id=$2::uuid AND trip_id=$3::uuid
              RETURNING *`,
            [responsible, id, trip.id],
          )
        : await client.query<Record<string, unknown>>(
            `UPDATE trip_occurrences
                SET updated_at=now()
              WHERE id=$1::uuid AND trip_id=$2::uuid
              RETURNING *`,
            [id, trip.id],
          );
      const row = updated.rows[0];
      if (!row) throw new NotFoundException('Occurrence not found in current trip');

      await client.query(
        `INSERT INTO trip_occurrence_history (
           tenant_id,occurrence_id,action,from_status,to_status,responsible_user_id,note,actor_user_id
         ) VALUES ($1::uuid,$2::uuid,'treatment',NULL,NULL,$3::uuid,$4,$5::uuid)`,
        [context.tenantId, id, responsible, treatment.note, context.userId],
      );
      return row;
    });
  }

  async setStatus(
    tripId: string,
    occurrenceId: string,
    input: unknown,
  ): Promise<Record<string, unknown>> {
    const transition = parseTripOccurrenceStatus(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireTrip(client, tripId, false);
      const id = requireUuid(occurrenceId, 'occurrenceId');
      const current = await this.requireOccurrence(client, trip.id, id, true);
      if (current.status === transition.status) {
        throw new ConflictException(`Occurrence is already ${transition.status}`);
      }

      const updated = await client.query<Record<string, unknown>>(
        `UPDATE trip_occurrences
            SET status=$1::varchar,
                resolved_at=CASE WHEN $1::varchar='resolved' THEN now() ELSE NULL END,
                resolved_by_user_id=CASE WHEN $1::varchar='resolved' THEN $2::uuid ELSE NULL END,
                updated_at=now()
          WHERE id=$3::uuid AND trip_id=$4::uuid
          RETURNING *`,
        [transition.status, context.userId, id, trip.id],
      );
      const row = updated.rows[0];
      if (!row) throw new NotFoundException('Occurrence not found in current trip');

      await client.query(
        `INSERT INTO trip_occurrence_history (
           tenant_id,occurrence_id,action,from_status,to_status,responsible_user_id,note,actor_user_id
         ) VALUES ($1::uuid,$2::uuid,'status_changed',$3,$4,$5::uuid,$6,$7::uuid)`,
        [
          context.tenantId,
          id,
          current.status,
          transition.status,
          current.responsible_user_id,
          transition.note,
          context.userId,
        ],
      );
      return row;
    });
  }

  async listDocuments(
    tripId: string,
    occurrenceId: string,
  ): Promise<readonly Record<string, unknown>[]> {
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireTrip(client, tripId, false);
      const id = requireUuid(occurrenceId, 'occurrenceId');
      await this.requireOccurrence(client, trip.id, id, false);
      const result = await client.query<Record<string, unknown>>(
        `SELECT *
           FROM trip_occurrence_documents
          WHERE occurrence_id=$1::uuid
          ORDER BY created_at,id`,
        [id],
      );
      return result.rows;
    });
  }

  async linkDocument(
    tripId: string,
    occurrenceId: string,
    input: unknown,
  ): Promise<Record<string, unknown>> {
    const link = parseTripOccurrenceDocument(input);
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      const trip = await this.requireTrip(client, tripId, false);
      const id = requireUuid(occurrenceId, 'occurrenceId');
      await this.requireOccurrence(client, trip.id, id, false);

      const document = await client.query(
        `SELECT 1 FROM documents WHERE id=$1::uuid AND deleted_at IS NULL`,
        [link.documentId],
      );
      if (document.rowCount !== 1) {
        throw new NotFoundException('Document not found in current tenant');
      }

      try {
        const inserted = await client.query<Record<string, unknown>>(
          `INSERT INTO trip_occurrence_documents (
             tenant_id,occurrence_id,document_id,relation_type,created_by_user_id
           ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid)
           RETURNING *`,
          [context.tenantId, id, link.documentId, link.relationType, context.userId],
        );
        const row = inserted.rows[0];
        if (!row) throw new ConflictException('Occurrence document could not be linked');
        return row;
      } catch (error) {
        if (hasPgCode(error, '23505')) {
          throw new ConflictException('Document is already linked to this occurrence');
        }
        throw error;
      }
    });
  }

  private async requireTrip(
    client: TenantQueryClient,
    tripId: string,
    forUpdate: boolean,
  ): Promise<TripStateRow> {
    const id = requireUuid(tripId, 'tripId');
    const result = await client.query<TripStateRow>(
      `SELECT id::text AS id,status::text AS status
         FROM trips
        WHERE id=$1::uuid${forUpdate ? ' FOR UPDATE' : ''}`,
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
      throw new ConflictException(`Trip occurrence is not allowed while status is ${trip.status}`);
    }
    return trip;
  }

  private async requireStop(
    client: TenantQueryClient,
    tripId: string,
    stopId: string,
  ): Promise<void> {
    const id = requireUuid(stopId, 'tripStopId');
    const result = await client.query(
      `SELECT 1 FROM trip_stops WHERE id=$1::uuid AND trip_id=$2::uuid`,
      [id, tripId],
    );
    if (result.rowCount !== 1) {
      throw new NotFoundException('Trip stop not found in current trip');
    }
  }

  private async requireOccurrence(
    client: TenantQueryClient,
    tripId: string,
    occurrenceId: string,
    forUpdate: boolean,
  ): Promise<OccurrenceStateRow> {
    const result = await client.query<OccurrenceStateRow>(
      `SELECT id::text AS id,status::text AS status,responsible_user_id::text AS responsible_user_id
         FROM trip_occurrences
        WHERE id=$1::uuid AND trip_id=$2::uuid${forUpdate ? ' FOR UPDATE' : ''}`,
      [occurrenceId, tripId],
    );
    const occurrence = result.rows[0];
    if (!occurrence) throw new NotFoundException('Occurrence not found in current trip');
    return occurrence;
  }

  private async requireActiveResponsible(client: TenantQueryClient, userId: string): Promise<void> {
    const result = await client.query(
      `SELECT 1
         FROM memberships m
         JOIN users u ON u.id=m.user_id
        WHERE m.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
          AND m.user_id=$1::uuid
          AND m.status='active'
          AND u.status='active'
        LIMIT 1`,
      [userId],
    );
    if (result.rowCount !== 1) {
      throw new ConflictException(
        'Responsible user must be an active member of the current tenant',
      );
    }
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
