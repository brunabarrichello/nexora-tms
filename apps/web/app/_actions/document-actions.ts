'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiSend } from '../_lib/api-client';
import type { DocumentTargetKind } from '../_lib/document-ui';

export type DocumentActionState =
  { readonly status: 'idle' } | { readonly status: 'error'; readonly message: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const targetKinds = new Set<DocumentTargetKind>(['party', 'driver', 'asset', 'request']);

export async function createDocument(
  _previous: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  return execute(async () => {
    const payload = {
      documentTypeId: requireUuid(formData.get('documentTypeId'), 'Tipo documental'),
      title: requiredText(formData.get('title'), 'Título'),
      issuedOn: optionalText(formData.get('issuedOn')) || null,
      expiresOn: optionalText(formData.get('expiresOn')) || null,
      externalReference: optionalText(formData.get('externalReference')) || null,
      notes: optionalText(formData.get('notes')) || null,
      metadata: jsonObject(formData.get('metadata'), 'Metadados'),
    };
    const result = await apiSend<Record<string, unknown>>('/api/v1/documents', 'POST', payload);
    if (result.kind !== 'ready') return errorState(result.message);
    const id = requireResponseId(result.data);
    revalidateDocuments(id);
    redirect(`/documentos/${id}?saved=1`);
  });
}

export async function updateDocument(
  _previous: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  return execute(async () => {
    const documentId = requireUuid(formData.get('documentId'), 'Documento');
    const payload = {
      title: requiredText(formData.get('title'), 'Título'),
      issuedOn: optionalText(formData.get('issuedOn')) || null,
      expiresOn: optionalText(formData.get('expiresOn')) || null,
      externalReference: optionalText(formData.get('externalReference')) || null,
      notes: optionalText(formData.get('notes')) || null,
      metadata: jsonObject(formData.get('metadata'), 'Metadados'),
    };
    const result = await apiSend<Record<string, unknown>>(
      `/api/v1/documents/${documentId}`,
      'PATCH',
      payload,
    );
    if (result.kind !== 'ready') return errorState(result.message);
    revalidateDocuments(documentId);
    redirect(`/documentos/${documentId}?saved=1`);
  });
}

export async function archiveDocument(
  _previous: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  return execute(async () => {
    const documentId = requireUuid(formData.get('documentId'), 'Documento');
    const result = await apiSend<Record<string, unknown>>(
      `/api/v1/documents/${documentId}/soft-delete`,
      'POST',
      { reason: requiredText(formData.get('reason'), 'Motivo') },
    );
    if (result.kind !== 'ready') return errorState(result.message);
    revalidateDocuments(documentId);
    redirect('/documentos?archived=1');
  });
}

export async function validateDocument(
  _previous: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  return execute(async () => {
    const documentId = requireUuid(formData.get('documentId'), 'Documento');
    const versionId = optionalText(formData.get('documentVersionId'));
    if (versionId && !uuidPattern.test(versionId)) throw new Error('Versão inválida.');
    const result = await apiSend<Record<string, unknown>>(
      `/api/v1/documents/${documentId}/validations`,
      'POST',
      {
        documentVersionId: versionId || null,
        validationType: requiredText(formData.get('validationType'), 'Tipo de validação'),
        result: requiredText(formData.get('result'), 'Resultado'),
        notes: optionalText(formData.get('notes')) || null,
        providerReference: optionalText(formData.get('providerReference')) || null,
        details: jsonObject(formData.get('details'), 'Detalhes'),
      },
    );
    if (result.kind !== 'ready') return errorState(result.message);
    revalidateDocuments(documentId);
    redirect(`/documentos/${documentId}?view=validations&saved=1`);
  });
}

export async function linkDocument(
  _previous: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  return execute(async () => {
    const documentId = requireUuid(formData.get('documentId'), 'Documento');
    const targetKind = requiredTargetKind(formData.get('targetKind'));
    const targetId = requireUuid(formData.get('targetId'), 'Entidade');
    const relationType = optionalText(formData.get('relationType'));
    const result = await apiSend<Record<string, unknown>>(
      linkEndpoint(documentId, targetKind, targetId),
      'POST',
      targetKind === 'party' || targetKind === 'request'
        ? { relationType: relationType || undefined }
        : {},
    );
    if (result.kind !== 'ready') return errorState(result.message);
    revalidateDocuments(documentId);
    redirect(`/documentos/${documentId}?saved=1`);
  });
}

function linkEndpoint(documentId: string, kind: DocumentTargetKind, targetId: string): string {
  const segments: Readonly<Record<DocumentTargetKind, string>> = {
    party: 'business-parties',
    driver: 'drivers',
    asset: 'assets',
    request: 'transport-requests',
  };
  return `/api/v1/documents/${documentId}/links/${segments[kind]}/${targetId}`;
}

function revalidateDocuments(documentId: string): void {
  revalidatePath('/documentos');
  revalidatePath(`/documentos/${documentId}`);
  revalidatePath('/documentos/validacoes');
  revalidatePath('/documentos/vencimentos');
}

async function execute(
  work: () => Promise<DocumentActionState | void>,
): Promise<DocumentActionState> {
  try {
    return (await work()) ?? { status: 'idle' };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return errorState(
      error instanceof Error ? error.message : 'Não foi possível concluir a operação.',
    );
  }
}

function errorState(message: string): DocumentActionState {
  return { status: 'error', message };
}

function requiredTargetKind(value: FormDataEntryValue | null): DocumentTargetKind {
  const kind = optionalText(value) as DocumentTargetKind;
  if (!targetKinds.has(kind)) throw new Error('Tipo de vínculo não suportado.');
  return kind;
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
