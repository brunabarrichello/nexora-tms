'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiSend } from '../_lib/api-client';

export type DocumentSaveState =
  { readonly status: 'idle' } | { readonly status: 'error'; readonly message: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createDocument(
  _previous: DocumentSaveState,
  formData: FormData,
): Promise<DocumentSaveState> {
  return execute(async () => {
    const payload = {
      documentTypeId: requireUuid(formData.get('documentTypeId'), 'Tipo documental'),
      title: requiredText(formData.get('title'), 'Título'),
      documentNumber: optionalText(formData.get('documentNumber')),
      issuer: optionalText(formData.get('issuer')),
      issuedOn: optionalText(formData.get('issuedOn')),
      expiresOn: optionalText(formData.get('expiresOn')),
      isBlocking: booleanValue(formData.get('isBlocking')),
      notes: optionalText(formData.get('notes')),
    };
    const result = await apiSend<Record<string, unknown>>('/api/v1/documents', 'POST', payload);
    if (result.kind !== 'ready') return { status: 'error' as const, message: result.message };
    const id = requireResponseId(result.data);
    revalidatePath('/documentos');
    redirect(`/documentos/${id}?saved=1`);
  });
}

export async function createDocumentVersion(
  _previous: DocumentSaveState,
  formData: FormData,
): Promise<DocumentSaveState> {
  return execute(async () => {
    const documentId = requireUuid(formData.get('documentId'), 'Documento');
    const payload = {
      storageProvider: requiredText(formData.get('storageProvider'), 'Provider'),
      storageKey: requiredText(formData.get('storageKey'), 'Chave do objeto'),
      fileName: requiredText(formData.get('fileName'), 'Nome do arquivo'),
      mimeType: requiredText(formData.get('mimeType'), 'MIME type'),
      sizeBytes: positiveInteger(formData.get('sizeBytes'), 'Tamanho em bytes'),
      sha256: requiredText(formData.get('sha256'), 'SHA-256'),
      source: requiredText(formData.get('source'), 'Origem'),
      metadata: jsonObject(formData.get('metadata'), 'Metadados'),
    };
    const result = await apiSend<Record<string, unknown>>(
      `/api/v1/documents/${documentId}/versions`,
      'POST',
      payload,
    );
    if (result.kind !== 'ready') return { status: 'error' as const, message: result.message };
    revalidateDocument(documentId);
    redirect(`/documentos/${documentId}?view=versions&saved=1`);
  });
}

export async function createDocumentValidation(
  _previous: DocumentSaveState,
  formData: FormData,
): Promise<DocumentSaveState> {
  return execute(async () => {
    const documentId = requireUuid(formData.get('documentId'), 'Documento');
    const versionId = optionalText(formData.get('versionId'));
    if (versionId && !uuidPattern.test(versionId))
      throw new Error('Versão deve ser um UUID válido.');
    const payload = {
      versionId,
      validationType: requiredText(formData.get('validationType'), 'Tipo de validação'),
      status: requiredText(formData.get('status'), 'Resultado'),
      provider: optionalText(formData.get('provider')),
      ruleCode: optionalText(formData.get('ruleCode')),
      details: jsonObject(formData.get('details'), 'Detalhes'),
      notes: optionalText(formData.get('notes')),
    };
    const result = await apiSend<Record<string, unknown>>(
      `/api/v1/documents/${documentId}/validations`,
      'POST',
      payload,
    );
    if (result.kind !== 'ready') return { status: 'error' as const, message: result.message };
    revalidateDocument(documentId);
    redirect(`/documentos/${documentId}?view=validations&saved=1`);
  });
}

export async function createDocumentLink(
  _previous: DocumentSaveState,
  formData: FormData,
): Promise<DocumentSaveState> {
  return execute(async () => {
    const documentId = requireUuid(formData.get('documentId'), 'Documento');
    const payload = {
      targetKind: requiredText(formData.get('targetKind'), 'Tipo de vínculo'),
      targetId: requireUuid(formData.get('targetId'), 'Entidade vinculada'),
      relationType: requiredText(formData.get('relationType'), 'Relação'),
    };
    const result = await apiSend<Record<string, unknown>>(
      `/api/v1/documents/${documentId}/links`,
      'POST',
      payload,
    );
    if (result.kind !== 'ready') return { status: 'error' as const, message: result.message };
    revalidateDocument(documentId);
    redirect(`/documentos/${documentId}?view=links&saved=1`);
  });
}

export async function unlinkDocumentLink(
  _previous: DocumentSaveState,
  formData: FormData,
): Promise<DocumentSaveState> {
  return execute(async () => {
    const documentId = requireUuid(formData.get('documentId'), 'Documento');
    const linkId = requireUuid(formData.get('linkId'), 'Vínculo');
    const result = await apiSend<Record<string, unknown>>(
      `/api/v1/documents/${documentId}/links/${linkId}/unlink`,
      'POST',
      { reason: requiredText(formData.get('reason'), 'Motivo') },
    );
    if (result.kind !== 'ready') return { status: 'error' as const, message: result.message };
    revalidateDocument(documentId);
    redirect(`/documentos/${documentId}?view=links&saved=1`);
  });
}

function revalidateDocument(documentId: string): void {
  revalidatePath('/documentos');
  revalidatePath(`/documentos/${documentId}`);
  revalidatePath('/documentos/validacoes');
  revalidatePath('/documentos/vencimentos');
}

async function execute(work: () => Promise<DocumentSaveState | void>): Promise<DocumentSaveState> {
  try {
    return (await work()) ?? { status: 'idle' };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Não foi possível concluir a operação.',
    };
  }
}

function requireResponseId(value: Record<string, unknown>): string {
  const id = typeof value.id === 'string' ? value.id : '';
  if (!uuidPattern.test(id)) throw new Error('A API não retornou um documento válido.');
  return id;
}

function requireUuid(value: FormDataEntryValue | null, label: string): string {
  const text = optionalText(value);
  if (!uuidPattern.test(text)) throw new Error(`${label} deve ser um UUID válido.`);
  return text;
}

function requiredText(value: FormDataEntryValue | null, label: string): string {
  const text = optionalText(value);
  if (!text) throw new Error(`${label} é obrigatório.`);
  return text;
}

function optionalText(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function booleanValue(value: FormDataEntryValue | null): boolean {
  return optionalText(value) === 'true';
}

function positiveInteger(value: FormDataEntryValue | null, label: string): number {
  const number = Number(optionalText(value));
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${label} deve ser um inteiro positivo.`);
  }
  return number;
}

function jsonObject(value: FormDataEntryValue | null, label: string): Record<string, unknown> {
  const text = optionalText(value) || '{}';
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} deve conter um objeto JSON válido.`);
  }
}

function isRedirectError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT'),
  );
}
