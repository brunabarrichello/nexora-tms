import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import { requireUuid, type TransportRequestStatus } from './transport-request.validation.js';
import {
  parseReplaceTransportRoute,
  type TransportRouteStopInput,
  type TransportStopType,
} from './transport-route.validation.js';

interface RequestRouteAnchorRow {
  readonly status: TransportRequestStatus;
  readonly shipper_party_id: string;
  readonly consignee_party_id: string;
  readonly origin_address_id: string;
  readonly destination_address_id: string;
}

interface RouteStopRow {
  readonly id: string;
  readonly sequence: number;
  readonly type: TransportStopType;
  readonly party_id: string;
  readonly address_id: string;
  readonly contact_id: string | null;
  readonly window_start_at: Date;
  readonly window_end_at: Date;
  readonly instructions: string | null;
  readonly address_label: string;
  readonly city: string;
  readonly state: string;
  readonly contact_name: string | null;
}

export interface TransportRouteStop {
  readonly id: string;
  readonly sequence: number;
  readonly type: TransportStopType;
  readonly partyId: string;
  readonly addressId: string;
  readonly contactId: string | null;
  readonly windowStartAt: string;
  readonly windowEndAt: string;
  readonly instructions: string | null;
  readonly addressLabel: string;
  readonly city: string;
  readonly state: string;
  readonly contactName: string | null;
}

export interface TransportRoute {
  readonly transportRequestId: string;
  readonly summary: string;
  readonly stops: readonly TransportRouteStop[];
}

@Injectable()
export class TransportRouteService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  async getRoute(requestId: string): Promise<TransportRoute> {
    const id = requireUuid(requestId, 'requestId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireRequest(client, id);
      return this.loadRoute(client, id);
    });
  }

  async replaceRoute(requestId: string, input: unknown): Promise<TransportRoute> {
    const id = requireUuid(requestId, 'requestId');
    const stops = parseReplaceTransportRoute(input);
    const context = this.tenantContext.require();

    return this.database.withTenantContext(context, async (client) => {
      const request = await this.requireRequest(client, id);
      if (request.status !== 'draft' && request.status !== 'ready_for_quote') {
        throw new ConflictException(
          `Route cannot be edited while transport request status is ${request.status}`,
        );
      }

      const first = stops[0]!;
      const last = stops[stops.length - 1]!;
      if (
        first.partyId !== request.shipper_party_id ||
        first.addressId !== request.origin_address_id
      ) {
        throw new BadRequestException(
          'The first pickup must match the transport request shipper and origin address',
        );
      }
      if (
        last.partyId !== request.consignee_party_id ||
        last.addressId !== request.destination_address_id
      ) {
        throw new BadRequestException(
          'The last delivery must match the transport request consignee and destination address',
        );
      }

      for (const stop of stops) {
        await this.assertStopReferences(client, stop);
      }

      await client.query(
        'DELETE FROM transport_request_stops WHERE transport_request_id = $1::uuid',
        [id],
      );

      for (const stop of stops) {
        await client.query(
          `INSERT INTO transport_request_stops (
             tenant_id, transport_request_id, sequence, type, party_id, address_id, contact_id,
             window_start_at, window_end_at, instructions
           ) VALUES (
             $1::uuid, $2::uuid, $3, $4::transport_stop_type, $5::uuid, $6::uuid, $7::uuid,
             $8::timestamptz, $9::timestamptz, $10
           )`,
          [
            context.tenantId,
            id,
            stop.sequence,
            stop.type,
            stop.partyId,
            stop.addressId,
            stop.contactId,
            stop.windowStartAt,
            stop.windowEndAt,
            stop.instructions,
          ],
        );
      }

      return this.loadRoute(client, id);
    });
  }

  private async requireRequest(
    client: TenantQueryClient,
    requestId: string,
  ): Promise<RequestRouteAnchorRow> {
    const result = await client.query<RequestRouteAnchorRow>(
      `SELECT
         status::text AS status,
         shipper_party_id::text AS shipper_party_id,
         consignee_party_id::text AS consignee_party_id,
         origin_address_id::text AS origin_address_id,
         destination_address_id::text AS destination_address_id
       FROM transport_requests
       WHERE id = $1::uuid`,
      [requestId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Transport request not found in current tenant');
    }
    return row;
  }

  private async assertStopReferences(
    client: TenantQueryClient,
    stop: TransportRouteStopInput,
  ): Promise<void> {
    const address = await client.query(
      `SELECT 1
         FROM business_party_addresses
        WHERE id = $1::uuid
          AND party_id = $2::uuid
          AND is_active
        LIMIT 1`,
      [stop.addressId, stop.partyId],
    );
    if (address.rowCount !== 1) {
      throw new BadRequestException(
        `stops[${stop.sequence - 1}].addressId must reference an active address owned by the selected party`,
      );
    }

    if (stop.contactId) {
      const contact = await client.query(
        `SELECT 1
           FROM business_party_contacts
          WHERE id = $1::uuid
            AND party_id = $2::uuid
            AND is_active
            AND (address_id IS NULL OR address_id = $3::uuid)
          LIMIT 1`,
        [stop.contactId, stop.partyId, stop.addressId],
      );
      if (contact.rowCount !== 1) {
        throw new BadRequestException(
          `stops[${stop.sequence - 1}].contactId must reference an active contact compatible with the selected point`,
        );
      }
    }
  }

  private async loadRoute(client: TenantQueryClient, requestId: string): Promise<TransportRoute> {
    const result = await client.query<RouteStopRow>(
      `SELECT
         s.id::text AS id,
         s.sequence,
         s.type::text AS type,
         s.party_id::text AS party_id,
         s.address_id::text AS address_id,
         s.contact_id::text AS contact_id,
         s.window_start_at,
         s.window_end_at,
         s.instructions,
         a.label AS address_label,
         a.city,
         a.state,
         c.name AS contact_name
       FROM transport_request_stops s
       JOIN business_party_addresses a
         ON a.tenant_id = s.tenant_id
        AND a.party_id = s.party_id
        AND a.id = s.address_id
       LEFT JOIN business_party_contacts c
         ON c.tenant_id = s.tenant_id
        AND c.party_id = s.party_id
        AND c.id = s.contact_id
       WHERE s.transport_request_id = $1::uuid
       ORDER BY s.sequence`,
      [requestId],
    );

    const stops = result.rows.map(mapRouteStop);
    return {
      transportRequestId: requestId,
      summary: stops.map((stop) => `${stop.city}/${stop.state}`).join(' → '),
      stops,
    };
  }
}

function mapRouteStop(row: RouteStopRow): TransportRouteStop {
  return {
    id: row.id,
    sequence: row.sequence,
    type: row.type,
    partyId: row.party_id,
    addressId: row.address_id,
    contactId: row.contact_id,
    windowStartAt: row.window_start_at.toISOString(),
    windowEndAt: row.window_end_at.toISOString(),
    instructions: row.instructions,
    addressLabel: row.address_label,
    city: row.city,
    state: row.state,
    contactName: row.contact_name,
  };
}
