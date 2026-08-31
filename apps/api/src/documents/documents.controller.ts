import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import { DocumentsService, type DocumentRecord } from './documents.service.js';
import type { PreparedDocumentDownload, PreparedDocumentUpload } from './document-storage.port.js';

@Controller('api/v1/documents')
@TenantAuthorized('documents.read')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(): Promise<readonly DocumentRecord[]> {
    return this.documents.list();
  }

  @Post()
  @TenantAuthorized('documents.write')
  create(@Body() body: unknown): Promise<DocumentRecord> {
    return this.documents.create(body);
  }

  @Get(':documentId')
  getById(@Param('documentId') documentId: string): Promise<DocumentRecord> {
    return this.documents.getById(documentId);
  }

  @Patch(':documentId')
  @TenantAuthorized('documents.write')
  update(@Param('documentId') documentId: string, @Body() body: unknown): Promise<DocumentRecord> {
    return this.documents.update(documentId, body);
  }

  @Post(':documentId/soft-delete')
  @TenantAuthorized('documents.write')
  softDelete(
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.softDelete(documentId, body);
  }

  @Post(':documentId/uploads/prepare')
  @TenantAuthorized('documents.write')
  prepareUpload(
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ): Promise<PreparedDocumentUpload> {
    return this.documents.prepareUpload(documentId, body);
  }

  @Post(':documentId/uploads/commit')
  @TenantAuthorized('documents.write')
  commitUpload(
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.commitUpload(documentId, body);
  }

  @Get(':documentId/versions')
  listVersions(@Param('documentId') documentId: string): Promise<readonly DocumentRecord[]> {
    return this.documents.listVersions(documentId);
  }

  @Get(':documentId/versions/:versionId/download')
  prepareDownload(
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ): Promise<PreparedDocumentDownload> {
    return this.documents.prepareDownload(documentId, versionId);
  }

  @Get(':documentId/validations')
  listValidations(@Param('documentId') documentId: string): Promise<readonly DocumentRecord[]> {
    return this.documents.listValidations(documentId);
  }

  @Post(':documentId/validations')
  @TenantAuthorized('documents.write')
  validate(
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.validate(documentId, body);
  }

  @Post(':documentId/links/business-parties/:partyId')
  @TenantAuthorized('documents.write')
  linkBusinessParty(
    @Param('documentId') documentId: string,
    @Param('partyId') partyId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.linkBusinessParty(documentId, partyId, body);
  }

  @Post(':documentId/links/transport-requests/:requestId')
  @TenantAuthorized('documents.write')
  linkTransportRequest(
    @Param('documentId') documentId: string,
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.linkTransportRequest(documentId, requestId, body);
  }

  @Post(':documentId/links/drivers/:driverId')
  @TenantAuthorized('documents.write')
  linkDriver(
    @Param('documentId') documentId: string,
    @Param('driverId') driverId: string,
  ): Promise<DocumentRecord> {
    return this.documents.linkDriver(documentId, driverId);
  }

  @Post(':documentId/links/assets/:assetId')
  @TenantAuthorized('documents.write')
  linkAsset(
    @Param('documentId') documentId: string,
    @Param('assetId') assetId: string,
  ): Promise<DocumentRecord> {
    return this.documents.linkAsset(documentId, assetId);
  }
}
