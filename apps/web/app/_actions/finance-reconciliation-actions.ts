'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiSend } from '../_lib/api-client';

export async function createReconciliationImport(formData: FormData): Promise<void> {
  const source = formString(formData, 'source');
  const provider = optionalString(formData, 'provider');
  const externalBatchId = optionalString(formData, 'externalBatchId');
  const accountReference = optionalString(formData, 'accountReference');
  const periodStart = optionalString(formData, 'periodStart');
  const periodEnd = optionalString(formData, 'periodEnd');
  const entriesJson = formString(formData, 'entriesJson');

  let entries: unknown;
  try {
    entries = JSON.parse(entriesJson);
  } catch {
    redirectWithError('/financeiro/conciliacao', 'As linhas importadas precisam estar em JSON válido.');
  }
  if (!Array.isArray(entries)) {
    redirectWithError('/financeiro/conciliacao', 'O JSON da importação precisa ser uma lista de linhas.');
  }

  const result = await apiSend<{ id: string }>('/api/v1/finance/reconciliation/imports', 'POST', {
    source,
    provider,
    externalBatchId,
    accountReference,
    periodStart,
    periodEnd,
    entries,
  });
  if (result.kind !== 'ready') redirectWithError('/financeiro/conciliacao', result.message);
  revalidatePath('/financeiro/conciliacao');
  redirect('/financeiro/conciliacao?imported=1');
}

export async function suggestReconciliationEntry(formData: FormData): Promise<void> {
  const entryId = requireUuid(formString(formData, 'entryId'));
  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/finance/reconciliation/entries/${entryId}/suggest`,
    'POST',
    {},
  );
  if (result.kind !== 'ready') redirectEntryError(entryId, result.message);
  revalidatePath('/financeiro/conciliacao');
  revalidatePath(`/financeiro/conciliacao/${entryId}`);
  redirect(`/financeiro/conciliacao/${entryId}?suggested=1`);
}

export async function reconcileEntry(formData: FormData): Promise<void> {
  const entryId = requireUuid(formString(formData, 'entryId'));
  const targetId = requireUuid(formString(formData, 'targetId'));
  const targetType = formString(formData, 'targetType');
  const matchMethod = formString(formData, 'matchMethod') || 'manual';
  const proofDocumentId = optionalString(formData, 'proofDocumentId');
  const notes = optionalString(formData, 'notes');
  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/finance/reconciliation/entries/${entryId}/reconcile`,
    'POST',
    { targetId, targetType, matchMethod, proofDocumentId, notes },
  );
  if (result.kind !== 'ready') redirectEntryError(entryId, result.message);
  revalidatePath('/financeiro/conciliacao');
  revalidatePath('/financeiro/faturamento');
  revalidatePath('/financeiro/pagamentos');
  revalidatePath(`/financeiro/conciliacao/${entryId}`);
  redirect(`/financeiro/conciliacao/${entryId}?reconciled=1`);
}

export async function ignoreReconciliationEntry(formData: FormData): Promise<void> {
  const entryId = requireUuid(formString(formData, 'entryId'));
  const reason = formString(formData, 'reason');
  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/finance/reconciliation/entries/${entryId}/ignore`,
    'POST',
    { reason },
  );
  if (result.kind !== 'ready') redirectEntryError(entryId, result.message);
  revalidatePath('/financeiro/conciliacao');
  revalidatePath(`/financeiro/conciliacao/${entryId}`);
  redirect(`/financeiro/conciliacao/${entryId}?ignored=1`);
}

export async function reverseReconciliationMatch(formData: FormData): Promise<void> {
  const entryId = requireUuid(formString(formData, 'entryId'));
  const matchId = requireUuid(formString(formData, 'matchId'));
  const reason = formString(formData, 'reason');
  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/finance/reconciliation/matches/${matchId}/reverse`,
    'POST',
    { reason },
  );
  if (result.kind !== 'ready') redirectEntryError(entryId, result.message);
  revalidatePath('/financeiro/conciliacao');
  revalidatePath('/financeiro/faturamento');
  revalidatePath('/financeiro/pagamentos');
  revalidatePath(`/financeiro/conciliacao/${entryId}`);
  redirect(`/financeiro/conciliacao/${entryId}?reversed=1`);
}

function formString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(formData: FormData, field: string): string | null {
  return formString(formData, field) || null;
}

function requireUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Identificador de conciliação inválido.');
  }
  return value;
}

function redirectEntryError(entryId: string, message: string): never {
  redirectWithError(`/financeiro/conciliacao/${entryId}`, message);
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message.slice(0, 240))}`);
}
