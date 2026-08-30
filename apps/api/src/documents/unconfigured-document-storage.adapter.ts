import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import type {
  CreateDocumentDownloadInput,
  DocumentStoragePort,
  PrepareDocumentUploadInput,
  PreparedDocumentDownload,
  PreparedDocumentUpload,
  VerifiedDocumentObject,
  VerifyDocumentUploadInput,
} from './document-storage.port.js';

@Injectable()
export class UnconfiguredDocumentStorageAdapter implements DocumentStoragePort {
  prepareUpload(input: PrepareDocumentUploadInput): Promise<PreparedDocumentUpload> {
    void input;
    throw this.notConfigured();
  }

  verifyUpload(input: VerifyDocumentUploadInput): Promise<VerifiedDocumentObject> {
    void input;
    throw this.notConfigured();
  }

  createDownloadUrl(input: CreateDocumentDownloadInput): Promise<PreparedDocumentDownload> {
    void input;
    throw this.notConfigured();
  }

  private notConfigured(): ServiceUnavailableException {
    return new ServiceUnavailableException(
      'Document object storage adapter is not configured for this environment',
    );
  }
}
