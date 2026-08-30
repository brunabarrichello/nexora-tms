export interface PrepareDocumentUploadInput {
  readonly tenantId: string;
  readonly documentId: string;
  readonly originalFileName: string;
  readonly mimeType: string;
  readonly expectedByteSize: number | null;
  readonly checksumSha256: string | null;
}

export interface PreparedDocumentUpload {
  readonly uploadId: string;
  readonly uploadUrl: string;
  readonly expiresAt: string;
}

export interface VerifyDocumentUploadInput {
  readonly tenantId: string;
  readonly documentId: string;
  readonly uploadId: string;
}

export interface VerifiedDocumentObject {
  readonly storageProvider: string;
  readonly storageKey: string;
  readonly originalFileName: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly checksumSha256: string;
}

export interface CreateDocumentDownloadInput {
  readonly tenantId: string;
  readonly documentId: string;
  readonly versionId: string;
  readonly storageProvider: string;
  readonly storageKey: string;
}

export interface PreparedDocumentDownload {
  readonly downloadUrl: string;
  readonly expiresAt: string;
}

export interface DocumentStoragePort {
  prepareUpload(input: PrepareDocumentUploadInput): Promise<PreparedDocumentUpload>;
  verifyUpload(input: VerifyDocumentUploadInput): Promise<VerifiedDocumentObject>;
  createDownloadUrl(input: CreateDocumentDownloadInput): Promise<PreparedDocumentDownload>;
}

export const DOCUMENT_STORAGE_PORT = Symbol('DOCUMENT_STORAGE_PORT');
