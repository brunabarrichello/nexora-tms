import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import {
  DocumentsService,
  type DocumentRecord,
} from './documents.service.js';
import type {
  PreparedDocumentDownload,
  PreparedDocumentUpload,
} from './document-storage.port.js';

@Controller('api/v1/documents')
@UseGuards(TenantRuntimeGateGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(): Promise<readonly DocumentRecord[]> {
    return this.documents.list();
  }

  @Post()
  create(@Body() body: unknown): Promise<DocumentRecord> {
    return this.documents.create(body);
  }

  @Get(':documentId')
  getById(@Param('documentId') documentId: string): Promise<DocumentRecord> {
    return this.documents.getById(documentId);
  }

  @Patch(':documentId')
  update(
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.update(documentId, body);
  }

  @Post(':documentId/soft-delete')
  softDelete(
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.softDelete(documentId, body);
  }

  @Post(':documentId/uploads/prepare')
  prepareUpload(
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ): Promise<PreparedDocumentUpload> {
    return this.documents.prepareUpload(documentId, body);
  }

  @Post(':documentId/uploads/commit')
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
  validate(
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.validate(documentId, body);
  }

  @Post(':documentId/links/business-parties/:partyId')
  linkBusinessParty(
    @Param('documentId') documentId: string,
    @Param('partyId') partyId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.linkBusinessParty(documentId, partyId, body);
  }

  @Post(':documentId/links/transport-requests/:requestId')
  linkTransportRequest(
    @Param('documentId') documentId: string,
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.linkTransportRequest(documentId, requestId, body);
  }

  @Post(':documentId/links/drivers/:driverId')
  linkDriver(
    @Param('documentId') documentId: string,
    @Param('driverId') driverId: string,
  ): Promise<DocumentRecord> {
    return this.documents.linkDriver(documentId, driverId);
  }

  @Post(':documentId/links/assets/:assetId')
  linkAsset(
    @Param('documentId') documentId: string,
    @Param('assetId') assetId: string,
  ): Promise<DocumentRecord> {
    return this.documents.linkAsset(documentId, assetId);
  }
}
