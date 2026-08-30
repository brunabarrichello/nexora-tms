import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { TenantRuntimeGateGuard } from '../tenant-runtime-gate.guard.js';
import {
  DocumentsService,
  type DocumentPage,
  type DocumentRecord,
} from './documents.service.js';

@Controller('api/v1/documents')
@UseGuards(TenantRuntimeGateGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>): Promise<DocumentPage> {
    return this.documents.list(query);
  }

  @Post()
  create(@Body() body: unknown): Promise<DocumentRecord> {
    return this.documents.create(body);
  }

  @Get(':documentId')
  get(@Param('documentId') documentId: string): Promise<DocumentRecord> {
    return this.documents.get(documentId);
  }

  @Get(':documentId/versions')
  listVersions(@Param('documentId') documentId: string): Promise<readonly DocumentRecord[]> {
    return this.documents.listVersions(documentId);
  }

  @Post(':documentId/versions')
  createVersion(
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.createVersion(documentId, body);
  }

  @Get(':documentId/validations')
  listValidations(@Param('documentId') documentId: string): Promise<readonly DocumentRecord[]> {
    return this.documents.listValidations(documentId);
  }

  @Post(':documentId/validations')
  createValidation(
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.createValidation(documentId, body);
  }

  @Get(':documentId/links')
  listLinks(@Param('documentId') documentId: string): Promise<readonly DocumentRecord[]> {
    return this.documents.listLinks(documentId);
  }

  @Post(':documentId/links')
  createLink(
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.createLink(documentId, body);
  }

  @Post(':documentId/links/:linkId/unlink')
  unlink(
    @Param('documentId') documentId: string,
    @Param('linkId') linkId: string,
    @Body() body: unknown,
  ): Promise<DocumentRecord> {
    return this.documents.unlink(documentId, linkId, body);
  }
}
