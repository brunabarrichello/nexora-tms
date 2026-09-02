import { Injectable, NotFoundException } from '@nestjs/common';

import { TenantDatabaseService } from '../tenancy/tenant-database.service.js';
import { IntegrationContext } from './integration-context.js';
import { parseLimit, requireUuid } from './integrations.validation.js';

export interface ExternalApiEnvelope<T> {
  readonly apiVersion: 'v1';
  readonly data: T;
}

@Injectable()
export class ExternalApiService {
  constructor(
    private readonly context: IntegrationContext,
    private readonly database: TenantDatabaseService,
  ) {}

  listTransportRequests(limitValue?: string): Promise<ExternalApiEnvelope<readonly unknown[]>> {
    const limit = parseLimit(limitValue);
    return this.withContext(
      'integration.api.freight.listed',
      'transport_request',
      null,
      async (client) => {
        const result = await client.query(
          `SELECT id::text AS id,
                customer_party_id::text AS "customerPartyId",
                shipper_party_id::text AS "shipperPartyId",
                consignee_party_id::text AS "consigneePartyId",
                origin_address_id::text AS "originAddressId",
                destination_address_id::text AS "destinationAddressId",
                planned_pickup_at AS "plannedPickupAt",
                planned_delivery_at AS "plannedDeliveryAt",
                cargo_description AS "cargoDescription",
                status,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
           FROM transport_requests
          ORDER BY created_at DESC,id DESC
          LIMIT $1::int`,
          [limit],
        );
        return result.rows.map(normalizeDates);
      },
    );
  }

  getTransportRequest(idValue: string): Promise<ExternalApiEnvelope<unknown>> {
    const id = requireUuid(idValue, 'transportRequestId');
    return this.withContext(
      'integration.api.freight.read',
      'transport_request',
      id,
      async (client) => {
        const result = await client.query(
          `SELECT id::text AS id,
                customer_party_id::text AS "customerPartyId",
                shipper_party_id::text AS "shipperPartyId",
                consignee_party_id::text AS "consigneePartyId",
                origin_address_id::text AS "originAddressId",
                destination_address_id::text AS "destinationAddressId",
                planned_pickup_at AS "plannedPickupAt",
                planned_delivery_at AS "plannedDeliveryAt",
                cargo_description AS "cargoDescription",
                status,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
           FROM transport_requests
          WHERE id=$1::uuid`,
          [id],
        );
        if (!result.rows[0]) throw new NotFoundException('Transport request not found');
        return normalizeDates(result.rows[0]);
      },
    );
  }

  listTrips(limitValue?: string): Promise<ExternalApiEnvelope<readonly unknown[]>> {
    const limit = parseLimit(limitValue);
    return this.withContext('integration.api.trips.listed', 'trip', null, async (client) => {
      const result = await client.query(
        `SELECT id::text AS id,
                code,status,
                planned_start_at AS "plannedStartAt",
                planned_end_at AS "plannedEndAt",
                actual_start_at AS "actualStartAt",
                actual_end_at AS "actualEndAt",
                origin_location_id::text AS "originLocationId",
                destination_location_id::text AS "destinationLocationId",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
           FROM trips
          ORDER BY created_at DESC,id DESC
          LIMIT $1::int`,
        [limit],
      );
      return result.rows.map(normalizeDates);
    });
  }

  getTrip(idValue: string): Promise<ExternalApiEnvelope<unknown>> {
    const id = requireUuid(idValue, 'tripId');
    return this.withContext('integration.api.trips.read', 'trip', id, async (client) => {
      const result = await client.query(
        `SELECT id::text AS id,
                code,status,
                planned_start_at AS "plannedStartAt",
                planned_end_at AS "plannedEndAt",
                actual_start_at AS "actualStartAt",
                actual_end_at AS "actualEndAt",
                origin_location_id::text AS "originLocationId",
                destination_location_id::text AS "destinationLocationId",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
           FROM trips
          WHERE id=$1::uuid`,
        [id],
      );
      if (!result.rows[0]) throw new NotFoundException('Trip not found');
      return normalizeDates(result.rows[0]);
    });
  }

  listDocuments(limitValue?: string): Promise<ExternalApiEnvelope<readonly unknown[]>> {
    const limit = parseLimit(limitValue);
    return this.withContext(
      'integration.api.documents.listed',
      'document',
      null,
      async (client) => {
        const result = await client.query(
          `SELECT id::text AS id,
                document_type_id::text AS "documentTypeId",
                title,status,issued_on AS "issuedOn",expires_on AS "expiresOn",
                external_reference AS "externalReference",
                created_at AS "createdAt",updated_at AS "updatedAt"
           FROM documents
          WHERE deleted_at IS NULL
          ORDER BY created_at DESC,id DESC
          LIMIT $1::int`,
          [limit],
        );
        return result.rows.map(normalizeDates);
      },
    );
  }

  getDocument(idValue: string): Promise<ExternalApiEnvelope<unknown>> {
    const id = requireUuid(idValue, 'documentId');
    return this.withContext('integration.api.documents.read', 'document', id, async (client) => {
      const result = await client.query(
        `SELECT id::text AS id,
                document_type_id::text AS "documentTypeId",
                title,status,issued_on AS "issuedOn",expires_on AS "expiresOn",
                external_reference AS "externalReference",
                created_at AS "createdAt",updated_at AS "updatedAt"
           FROM documents
          WHERE id=$1::uuid AND deleted_at IS NULL`,
        [id],
      );
      if (!result.rows[0]) throw new NotFoundException('Document not found');
      return normalizeDates(result.rows[0]);
    });
  }

  private async withContext<T>(
    action: string,
    entityType: string,
    entityId: string | null,
    work: (client: import('pg').PoolClient) => Promise<T>,
  ): Promise<ExternalApiEnvelope<T>> {
    const context = this.context.require();
    const data = await this.database.withIntegrationContext(context, async (client) => {
      const result = await work(client);
      await client.query(
        `INSERT INTO audit_events (
           tenant_id,action,outcome,source,entity_type,entity_id,
           actor_type,actor_external_id,metadata
         ) VALUES ($1::uuid,$2,'success','integration',$3,$4,'integration',$5,$6::jsonb)`,
        [
          context.tenantId,
          action,
          entityType,
          entityId,
          `integration-client:${context.clientId}`,
          JSON.stringify({ clientName: context.clientName, scopes: context.scopes }),
        ],
      );
      return result;
    });
    return { apiVersion: 'v1', data };
  }
}

function normalizeDates(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  );
}
