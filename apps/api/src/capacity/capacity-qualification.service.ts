import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { TenantContext } from '../tenancy/tenant-context.js';
import {
  TenantDatabaseService,
  type TenantQueryClient,
} from '../tenancy/tenant-database.service.js';
import {
  parseAssetCapabilities,
  parseAssetLocation,
  parseAvailability,
  parseBlock,
  parseCourse,
  parseDocumentRegister,
  parseEmergencyContact,
  parseInspection,
  parseInsurance,
  parseMaintenance,
  parseMaintenanceItem,
  parseMaintenancePlan,
  parseQualification,
  parseRating,
  parseReleaseBlock,
  parseUnavailability,
  requireUuid,
} from './capacity-qualification.validation.js';

export type QualificationRecord = Readonly<Record<string, unknown>>;

@Injectable()
export class CapacityQualificationService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly database: TenantDatabaseService,
  ) {}

  listDriverDocuments(driverId: string): Promise<readonly QualificationRecord[]> {
    return this.driverList('driver_documents', driverId, 'expires_on NULLS LAST, created_at DESC');
  }

  createDriverDocument(driverId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseDocumentRegister(input);
    return this.driverCreate(driverId, async (client, context, id) => {
      await this.requireDocumentType(client, data.documentTypeId, ['driver', 'other']);
      return this.insertAndFetch(
        client,
        `INSERT INTO driver_documents (
           tenant_id,driver_id,document_type_id,document_number,issuer,issued_on,expires_on,status,
           validation_status,notes,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.documentTypeId,
          data.documentNumber,
          data.issuer,
          data.issuedOn,
          data.expiresOn,
          data.status,
          data.validationStatus,
          data.notes,
          context.userId,
        ],
        'driver_documents',
      );
    });
  }

  listDriverQualifications(driverId: string): Promise<readonly QualificationRecord[]> {
    return this.driverList('driver_qualifications', driverId, 'expires_on NULLS LAST, code');
  }

  createDriverQualification(driverId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseQualification(input);
    return this.driverCreate(driverId, (client, context, id) =>
      this.insertAndFetch(
        client,
        `INSERT INTO driver_qualifications (
           tenant_id,driver_id,qualification_type,code,name,certificate_number,issuer,issued_on,expires_on,
           status,notes,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.qualificationType,
          data.code,
          data.name,
          data.certificateNumber,
          data.issuer,
          data.issuedOn,
          data.expiresOn,
          data.status,
          data.notes,
          context.userId,
        ],
        'driver_qualifications',
      ),
    );
  }

  listDriverCourses(driverId: string): Promise<readonly QualificationRecord[]> {
    return this.driverList('driver_courses', driverId, 'expires_on NULLS LAST, completed_on DESC');
  }

  createDriverCourse(driverId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseCourse(input);
    return this.driverCreate(driverId, (client, context, id) =>
      this.insertAndFetch(
        client,
        `INSERT INTO driver_courses (
           tenant_id,driver_id,course_code,course_name,provider,certificate_number,completed_on,expires_on,
           workload_hours,status,notes,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.courseCode,
          data.courseName,
          data.provider,
          data.certificateNumber,
          data.completedOn,
          data.expiresOn,
          data.workloadHours,
          data.status,
          data.notes,
          context.userId,
        ],
        'driver_courses',
      ),
    );
  }

  getDriverAvailability(driverId: string): Promise<QualificationRecord> {
    return this.driverOne('driver_availability', driverId);
  }

  setDriverAvailability(driverId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseAvailability(input);
    return this.driverCreate(driverId, async (client, context, id) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO driver_availability (
           tenant_id,driver_id,status,available_from,available_until,current_city_id,destination_city_id,
           max_distance_km,notes,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
         ON CONFLICT (tenant_id,driver_id) DO UPDATE SET
           status=excluded.status,available_from=excluded.available_from,available_until=excluded.available_until,
           current_city_id=excluded.current_city_id,destination_city_id=excluded.destination_city_id,
           max_distance_km=excluded.max_distance_km,notes=excluded.notes,
           updated_by_user_id=excluded.updated_by_user_id,updated_at=now()
         RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.status,
          data.availableFrom,
          data.availableUntil,
          data.currentCityId,
          data.destinationCityId,
          data.maxDistanceKm,
          data.notes,
          context.userId,
        ],
      );
      return this.fetchById(client, 'driver_availability', result.rows[0]!.id);
    });
  }

  listDriverUnavailability(driverId: string): Promise<readonly QualificationRecord[]> {
    return this.driverList('driver_unavailability_periods', driverId, 'starts_at DESC');
  }

  createDriverUnavailability(driverId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseUnavailability(input);
    return this.driverCreate(driverId, (client, context, id) =>
      this.insertAndFetch(
        client,
        `INSERT INTO driver_unavailability_periods (
           tenant_id,driver_id,reason_code,reason,starts_at,ends_at,status,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.reasonCode,
          data.reason,
          data.startsAt,
          data.endsAt,
          data.status,
          context.userId,
        ],
        'driver_unavailability_periods',
      ),
    );
  }

  listDriverEmergencyContacts(driverId: string): Promise<readonly QualificationRecord[]> {
    return this.driverList('driver_emergency_contacts', driverId, 'is_primary DESC, name');
  }

  createDriverEmergencyContact(driverId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseEmergencyContact(input);
    return this.driverCreate(driverId, (client, context, id) =>
      this.insertAndFetch(
        client,
        `INSERT INTO driver_emergency_contacts (
           tenant_id,driver_id,name,relationship,phone,is_primary,is_active,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.name,
          data.relationship,
          data.phone,
          data.isPrimary,
          data.isActive,
          context.userId,
        ],
        'driver_emergency_contacts',
      ),
    );
  }

  listDriverBlocks(driverId: string): Promise<readonly QualificationRecord[]> {
    return this.driverList('driver_blocks', driverId, 'released_at NULLS FIRST, starts_at DESC');
  }

  createDriverBlock(driverId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseBlock(input);
    return this.driverCreate(driverId, (client, context, id) =>
      this.insertAndFetch(
        client,
        `INSERT INTO driver_blocks (
           tenant_id,driver_id,reason_code,reason,severity,starts_at,ends_at,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,coalesce($6::timestamptz,now()),$7,$8,$8) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.reasonCode,
          data.reason,
          data.severity,
          data.startsAt,
          data.endsAt,
          context.userId,
        ],
        'driver_blocks',
      ),
    );
  }

  releaseDriverBlock(
    driverId: string,
    blockId: string,
    input: unknown,
  ): Promise<QualificationRecord> {
    return this.releaseBlock(
      'driver_blocks',
      'driver_id',
      driverId,
      blockId,
      input,
      this.requireDriver.bind(this),
    );
  }

  listDriverRatings(driverId: string): Promise<readonly QualificationRecord[]> {
    return this.driverList('driver_ratings', driverId, 'created_at DESC');
  }

  createDriverRating(driverId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseRating(input);
    return this.driverCreate(driverId, async (client, context, id) => {
      if (data.transportRequestId)
        await this.requireTenantEntity(
          client,
          'transport_requests',
          data.transportRequestId,
          'transport request',
        );
      return this.insertAndFetch(
        client,
        `INSERT INTO driver_ratings (
           tenant_id,driver_id,transport_request_id,dimension,score,note,actor_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.transportRequestId,
          data.dimension,
          data.score,
          data.note,
          context.userId,
        ],
        'driver_ratings',
      );
    });
  }

  getAssetCapabilities(assetId: string): Promise<QualificationRecord> {
    return this.assetOne('capacity_asset_capabilities', assetId);
  }

  setAssetCapabilities(assetId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseAssetCapabilities(input);
    return this.assetCreate(assetId, async (client, context, id) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO capacity_asset_capabilities (
           tenant_id,asset_id,refrigerated,sealed,side_loading,rear_loading,dangerous_goods,food_grade,
           tracking_capable,max_pallets,min_temperature_c,max_temperature_c,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
         ON CONFLICT (tenant_id,asset_id) DO UPDATE SET
           refrigerated=excluded.refrigerated,sealed=excluded.sealed,side_loading=excluded.side_loading,
           rear_loading=excluded.rear_loading,dangerous_goods=excluded.dangerous_goods,food_grade=excluded.food_grade,
           tracking_capable=excluded.tracking_capable,max_pallets=excluded.max_pallets,
           min_temperature_c=excluded.min_temperature_c,max_temperature_c=excluded.max_temperature_c,
           updated_by_user_id=excluded.updated_by_user_id,updated_at=now()
         RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.refrigerated,
          data.sealed,
          data.sideLoading,
          data.rearLoading,
          data.dangerousGoods,
          data.foodGrade,
          data.trackingCapable,
          data.maxPallets,
          data.minTemperatureC,
          data.maxTemperatureC,
          context.userId,
        ],
      );
      return this.fetchById(client, 'capacity_asset_capabilities', result.rows[0]!.id);
    });
  }

  listAssetDocuments(assetId: string): Promise<readonly QualificationRecord[]> {
    return this.assetList(
      'capacity_asset_documents',
      assetId,
      'expires_on NULLS LAST, created_at DESC',
    );
  }

  createAssetDocument(assetId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseDocumentRegister(input);
    return this.assetCreate(assetId, async (client, context, id) => {
      await this.requireDocumentType(client, data.documentTypeId, ['asset', 'other']);
      return this.insertAndFetch(
        client,
        `INSERT INTO capacity_asset_documents (
           tenant_id,asset_id,document_type_id,document_number,issuer,issued_on,expires_on,status,
           validation_status,notes,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.documentTypeId,
          data.documentNumber,
          data.issuer,
          data.issuedOn,
          data.expiresOn,
          data.status,
          data.validationStatus,
          data.notes,
          context.userId,
        ],
        'capacity_asset_documents',
      );
    });
  }

  listMaintenancePlans(assetId: string): Promise<readonly QualificationRecord[]> {
    return this.assetList(
      'capacity_asset_maintenance_plans',
      assetId,
      'is_active DESC, next_due_on NULLS LAST, name',
    );
  }

  createMaintenancePlan(assetId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseMaintenancePlan(input);
    return this.assetCreate(assetId, (client, context, id) =>
      this.insertAndFetch(
        client,
        `INSERT INTO capacity_asset_maintenance_plans (
           tenant_id,asset_id,name,maintenance_type,interval_days,interval_odometer_km,next_due_on,
           next_due_odometer_km,is_active,notes,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.name,
          data.maintenanceType,
          data.intervalDays,
          data.intervalOdometerKm,
          data.nextDueOn,
          data.nextDueOdometerKm,
          data.isActive,
          data.notes,
          context.userId,
        ],
        'capacity_asset_maintenance_plans',
      ),
    );
  }

  listMaintenance(assetId: string): Promise<readonly QualificationRecord[]> {
    return this.assetList(
      'capacity_asset_maintenance',
      assetId,
      'planned_at DESC NULLS LAST, created_at DESC',
    );
  }

  createMaintenance(assetId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseMaintenance(input);
    return this.assetCreate(assetId, async (client, context, id) => {
      if (data.maintenancePlanId)
        await this.requireOwnedChild(
          client,
          'capacity_asset_maintenance_plans',
          data.maintenancePlanId,
          'asset_id',
          id,
          'maintenance plan',
        );
      if (data.providerPartyId)
        await this.requireTenantEntity(
          client,
          'business_parties',
          data.providerPartyId,
          'provider party',
        );
      return this.insertAndFetch(
        client,
        `INSERT INTO capacity_asset_maintenance (
           tenant_id,asset_id,maintenance_plan_id,provider_party_id,maintenance_type,status,planned_at,started_at,
           completed_at,odometer_km,total_cost,currency_id,notes,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.maintenancePlanId,
          data.providerPartyId,
          data.maintenanceType,
          data.status,
          data.plannedAt,
          data.startedAt,
          data.completedAt,
          data.odometerKm,
          data.totalCost,
          data.currencyId,
          data.notes,
          context.userId,
        ],
        'capacity_asset_maintenance',
      );
    });
  }

  listMaintenanceItems(
    assetId: string,
    maintenanceId: string,
  ): Promise<readonly QualificationRecord[]> {
    const asset = requireUuid(assetId, 'assetId');
    const maintenance = requireUuid(maintenanceId, 'maintenanceId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireAsset(client, asset);
      await this.requireOwnedChild(
        client,
        'capacity_asset_maintenance',
        maintenance,
        'asset_id',
        asset,
        'maintenance',
      );
      const result = await client.query<QualificationRecord>(
        `SELECT * FROM capacity_asset_maintenance_items WHERE maintenance_id=$1::uuid ORDER BY created_at,id`,
        [maintenance],
      );
      return result.rows;
    });
  }

  createMaintenanceItem(
    assetId: string,
    maintenanceId: string,
    input: unknown,
  ): Promise<QualificationRecord> {
    const data = parseMaintenanceItem(input);
    const asset = requireUuid(assetId, 'assetId');
    const maintenance = requireUuid(maintenanceId, 'maintenanceId');
    const context = this.tenantContext.require();
    return this.wrap(async () =>
      this.database.withTenantContext(context, async (client) => {
        await this.requireAsset(client, asset);
        await this.requireOwnedChild(
          client,
          'capacity_asset_maintenance',
          maintenance,
          'asset_id',
          asset,
          'maintenance',
        );
        return this.insertAndFetch(
          client,
          `INSERT INTO capacity_asset_maintenance_items (
           tenant_id,maintenance_id,item_type,description,quantity,unit_amount,total_amount,currency_id,
           created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id::text AS id`,
          [
            context.tenantId,
            maintenance,
            data.itemType,
            data.description,
            data.quantity,
            data.unitAmount,
            data.totalAmount,
            data.currencyId,
            context.userId,
          ],
          'capacity_asset_maintenance_items',
        );
      }),
    );
  }

  listInsurances(assetId: string): Promise<readonly QualificationRecord[]> {
    return this.assetList('capacity_asset_insurances', assetId, 'ends_on DESC, policy_number');
  }

  createInsurance(assetId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseInsurance(input);
    return this.assetCreate(assetId, async (client, context, id) => {
      if (data.insurerPartyId)
        await this.requireTenantEntity(
          client,
          'business_parties',
          data.insurerPartyId,
          'insurer party',
        );
      return this.insertAndFetch(
        client,
        `INSERT INTO capacity_asset_insurances (
           tenant_id,asset_id,insurer_party_id,policy_number,starts_on,ends_on,coverage_amount,currency_id,
           status,notes,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.insurerPartyId,
          data.policyNumber,
          data.startsOn,
          data.endsOn,
          data.coverageAmount,
          data.currencyId,
          data.status,
          data.notes,
          context.userId,
        ],
        'capacity_asset_insurances',
      );
    });
  }

  listInspections(assetId: string): Promise<readonly QualificationRecord[]> {
    return this.assetList('capacity_asset_inspections', assetId, 'performed_at DESC');
  }

  createInspection(assetId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseInspection(input);
    return this.assetCreate(assetId, (client, context, id) =>
      this.insertAndFetch(
        client,
        `INSERT INTO capacity_asset_inspections (
           tenant_id,asset_id,inspection_type,inspector_user_id,performed_at,result,status,checklist,notes,next_due_at,
           created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$11) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.inspectionType,
          data.inspectorUserId,
          data.performedAt,
          data.result,
          data.status,
          JSON.stringify(data.checklist),
          data.notes,
          data.nextDueAt,
          context.userId,
        ],
        'capacity_asset_inspections',
      ),
    );
  }

  getAssetAvailability(assetId: string): Promise<QualificationRecord> {
    return this.assetOne('capacity_asset_availability', assetId);
  }

  setAssetAvailability(assetId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseAvailability(input, true);
    return this.assetCreate(assetId, async (client, context, id) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO capacity_asset_availability (
           tenant_id,asset_id,status,available_from,available_until,current_city_id,notes,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
         ON CONFLICT (tenant_id,asset_id) DO UPDATE SET
           status=excluded.status,available_from=excluded.available_from,available_until=excluded.available_until,
           current_city_id=excluded.current_city_id,notes=excluded.notes,
           updated_by_user_id=excluded.updated_by_user_id,updated_at=now()
         RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.status,
          data.availableFrom,
          data.availableUntil,
          data.currentCityId,
          data.notes,
          context.userId,
        ],
      );
      return this.fetchById(client, 'capacity_asset_availability', result.rows[0]!.id);
    });
  }

  listAssetUnavailability(assetId: string): Promise<readonly QualificationRecord[]> {
    return this.assetList('capacity_asset_unavailability_periods', assetId, 'starts_at DESC');
  }

  createAssetUnavailability(assetId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseUnavailability(input);
    return this.assetCreate(assetId, (client, context, id) =>
      this.insertAndFetch(
        client,
        `INSERT INTO capacity_asset_unavailability_periods (
           tenant_id,asset_id,reason_code,reason,starts_at,ends_at,status,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.reasonCode,
          data.reason,
          data.startsAt,
          data.endsAt,
          data.status,
          context.userId,
        ],
        'capacity_asset_unavailability_periods',
      ),
    );
  }

  listAssetLocations(assetId: string): Promise<readonly QualificationRecord[]> {
    return this.assetList('capacity_asset_locations', assetId, 'observed_at DESC');
  }

  createAssetLocation(assetId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseAssetLocation(input);
    return this.assetCreate(assetId, (client, context, id) =>
      this.insertAndFetch(
        client,
        `INSERT INTO capacity_asset_locations (
           tenant_id,asset_id,city_id,observed_at,latitude,longitude,source,accuracy_m,provider_reference
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.cityId,
          data.observedAt,
          data.latitude,
          data.longitude,
          data.source,
          data.accuracyM,
          data.providerReference,
        ],
        'capacity_asset_locations',
      ),
    );
  }

  listAssetBlocks(assetId: string): Promise<readonly QualificationRecord[]> {
    return this.assetList(
      'capacity_asset_blocks',
      assetId,
      'released_at NULLS FIRST, starts_at DESC',
    );
  }

  createAssetBlock(assetId: string, input: unknown): Promise<QualificationRecord> {
    const data = parseBlock(input, true);
    return this.assetCreate(assetId, (client, context, id) =>
      this.insertAndFetch(
        client,
        `INSERT INTO capacity_asset_blocks (
           tenant_id,asset_id,reason_code,reason,severity,starts_at,ends_at,created_by_user_id,updated_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,coalesce($6::timestamptz,now()),$7,$8,$8) RETURNING id::text AS id`,
        [
          context.tenantId,
          id,
          data.reasonCode,
          data.reason,
          data.severity,
          data.startsAt,
          data.endsAt,
          context.userId,
        ],
        'capacity_asset_blocks',
      ),
    );
  }

  releaseAssetBlock(
    assetId: string,
    blockId: string,
    input: unknown,
  ): Promise<QualificationRecord> {
    return this.releaseBlock(
      'capacity_asset_blocks',
      'asset_id',
      assetId,
      blockId,
      input,
      this.requireAsset.bind(this),
    );
  }

  private async driverList(
    table: string,
    driverId: string,
    orderBy: string,
  ): Promise<readonly QualificationRecord[]> {
    const id = requireUuid(driverId, 'driverId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireDriver(client, id);
      const result = await client.query<QualificationRecord>(
        `SELECT * FROM ${table} WHERE driver_id=$1::uuid ORDER BY ${orderBy}`,
        [id],
      );
      return result.rows;
    });
  }

  private async driverOne(table: string, driverId: string): Promise<QualificationRecord> {
    const id = requireUuid(driverId, 'driverId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireDriver(client, id);
      const result = await client.query<QualificationRecord>(
        `SELECT * FROM ${table} WHERE driver_id=$1::uuid`,
        [id],
      );
      if (!result.rows[0]) throw new NotFoundException('driver qualification record not found');
      return result.rows[0];
    });
  }

  private driverCreate(
    driverId: string,
    work: (
      client: TenantQueryClient,
      context: { tenantId: string; userId: string },
      driverId: string,
    ) => Promise<QualificationRecord>,
  ): Promise<QualificationRecord> {
    const id = requireUuid(driverId, 'driverId');
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        await this.requireDriver(client, id);
        return work(client, context, id);
      }),
    );
  }

  private async assetList(
    table: string,
    assetId: string,
    orderBy: string,
  ): Promise<readonly QualificationRecord[]> {
    const id = requireUuid(assetId, 'assetId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireAsset(client, id);
      const result = await client.query<QualificationRecord>(
        `SELECT * FROM ${table} WHERE asset_id=$1::uuid ORDER BY ${orderBy}`,
        [id],
      );
      return result.rows;
    });
  }

  private async assetOne(table: string, assetId: string): Promise<QualificationRecord> {
    const id = requireUuid(assetId, 'assetId');
    const context = this.tenantContext.require();
    return this.database.withTenantContext(context, async (client) => {
      await this.requireAsset(client, id);
      const result = await client.query<QualificationRecord>(
        `SELECT * FROM ${table} WHERE asset_id=$1::uuid`,
        [id],
      );
      if (!result.rows[0]) throw new NotFoundException('asset qualification record not found');
      return result.rows[0];
    });
  }

  private assetCreate(
    assetId: string,
    work: (
      client: TenantQueryClient,
      context: { tenantId: string; userId: string },
      assetId: string,
    ) => Promise<QualificationRecord>,
  ): Promise<QualificationRecord> {
    const id = requireUuid(assetId, 'assetId');
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        await this.requireAsset(client, id);
        return work(client, context, id);
      }),
    );
  }

  private async releaseBlock(
    table: 'driver_blocks' | 'capacity_asset_blocks',
    ownerColumn: 'driver_id' | 'asset_id',
    ownerId: string,
    blockId: string,
    input: unknown,
    requireOwner: (client: TenantQueryClient, id: string) => Promise<void>,
  ): Promise<QualificationRecord> {
    const owner = requireUuid(ownerId, ownerColumn === 'driver_id' ? 'driverId' : 'assetId');
    const block = requireUuid(blockId, 'blockId');
    const data = parseReleaseBlock(input);
    const context = this.tenantContext.require();
    return this.wrap(() =>
      this.database.withTenantContext(context, async (client) => {
        await requireOwner(client, owner);
        const result = await client.query<{ id: string }>(
          `UPDATE ${table}
            SET released_at=now(),released_by_user_id=$1::uuid,release_reason=$2,
                updated_by_user_id=$1::uuid,updated_at=now()
          WHERE id=$3::uuid AND ${ownerColumn}=$4::uuid AND released_at IS NULL
          RETURNING id::text AS id`,
          [context.userId, data.releaseReason, block, owner],
        );
        if (!result.rows[0]) throw new NotFoundException('active block not found');
        return this.fetchById(client, table, result.rows[0].id);
      }),
    );
  }

  private async requireDriver(client: TenantQueryClient, id: string): Promise<void> {
    await this.requireTenantEntity(client, 'drivers', id, 'driver');
  }

  private async requireAsset(client: TenantQueryClient, id: string): Promise<void> {
    await this.requireTenantEntity(client, 'capacity_assets', id, 'capacity asset');
  }

  private async requireTenantEntity(
    client: TenantQueryClient,
    table: string,
    id: string,
    label: string,
  ): Promise<void> {
    const result = await client.query(`SELECT 1 FROM ${table} WHERE id=$1::uuid LIMIT 1`, [id]);
    if (result.rowCount !== 1) throw new NotFoundException(`${label} not found`);
  }

  private async requireDocumentType(
    client: TenantQueryClient,
    id: string,
    scopes: readonly string[],
  ): Promise<void> {
    const result = await client.query<{ subject_scope: string }>(
      `SELECT subject_scope FROM document_types WHERE id=$1::uuid AND is_active=true LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('document type not found');
    if (!scopes.includes(row.subject_scope))
      throw new BadRequestException(`document type scope ${row.subject_scope} is not compatible`);
  }

  private async requireOwnedChild(
    client: TenantQueryClient,
    table: string,
    id: string,
    ownerColumn: string,
    ownerId: string,
    label: string,
  ): Promise<void> {
    const result = await client.query(
      `SELECT 1 FROM ${table} WHERE id=$1::uuid AND ${ownerColumn}=$2::uuid LIMIT 1`,
      [id, ownerId],
    );
    if (result.rowCount !== 1) throw new NotFoundException(`${label} not found for asset`);
  }

  private async insertAndFetch(
    client: TenantQueryClient,
    sql: string,
    values: readonly unknown[],
    table: string,
  ): Promise<QualificationRecord> {
    const result = await client.query<{ id: string }>(sql, values as unknown[]);
    return this.fetchById(client, table, result.rows[0]!.id);
  }

  private async fetchById(
    client: TenantQueryClient,
    table: string,
    id: string,
  ): Promise<QualificationRecord> {
    const result = await client.query<QualificationRecord>(
      `SELECT * FROM ${table} WHERE id=$1::uuid`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('qualification record not found');
    return result.rows[0];
  }

  private async wrap<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      )
        throw error;
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === '23505')
        throw new ConflictException(
          'qualification record conflicts with an existing active record',
        );
      if (code === '23503')
        throw new BadRequestException('referenced entity does not exist in this tenant');
      if (code === '23514' || code === '22P02')
        throw new BadRequestException('qualification data violates a database constraint');
      throw error;
    }
  }
}
