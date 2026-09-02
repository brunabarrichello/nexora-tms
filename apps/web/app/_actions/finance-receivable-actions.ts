'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiSend } from '../_lib/api-client';

export async function createCustomerReceivable(formData: FormData): Promise<void> {
  const transportRequestId = formString(formData, 'transportRequestId');
  const invoicedAmount = formString(formData, 'invoicedAmount');
  const dueDate = formString(formData, 'dueDate');
  const fiscalDocumentId = optionalString(formData, 'fiscalDocumentId');
  const fiscalReference = optionalString(formData, 'fiscalReference');
  const notes = optionalString(formData, 'notes');

  const result = await apiSend<{ id: string }>('/api/v1/finance/receivables/titles', 'POST', {
    transportRequestId,
    invoicedAmount,
    dueAt: dueDate ? `${dueDate}T12:00:00.000Z` : '',
    fiscalDocumentId,
    fiscalReference,
    notes,
  });
  if (result.kind !== 'ready') redirectWithError('/financeiro/faturamento', result.message);
  revalidatePath('/financeiro/faturamento');
  redirect(`/financeiro/faturamento/${result.data.id}?created=1`);
}

export async function updateCustomerReceivable(formData: FormData): Promise<void> {
  const receivableId = requireUuid(formString(formData, 'receivableId'));
  const dueDate = formString(formData, 'dueDate');
  const fiscalDocumentId = optionalString(formData, 'fiscalDocumentId');
  const fiscalReference = optionalString(formData, 'fiscalReference');
  const notes = optionalString(formData, 'notes');
  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/finance/receivables/titles/${receivableId}`,
    'PATCH',
    {
      dueAt: dueDate ? `${dueDate}T12:00:00.000Z` : undefined,
      fiscalDocumentId,
      fiscalReference,
      notes,
    },
  );
  if (result.kind !== 'ready')
    redirectWithError(`/financeiro/faturamento/${receivableId}`, result.message);
  revalidatePath('/financeiro/faturamento');
  revalidatePath(`/financeiro/faturamento/${receivableId}`);
  redirect(`/financeiro/faturamento/${receivableId}?updated=1`);
}

export async function recordCustomerReceipt(formData: FormData): Promise<void> {
  const receivableId = requireUuid(formString(formData, 'receivableId'));
  const kind = formString(formData, 'kind');
  const amount = formString(formData, 'amount');
  const relatedTransactionId = optionalString(formData, 'relatedTransactionId');
  const proofDocumentId = optionalString(formData, 'proofDocumentId');
  const notes = optionalString(formData, 'notes');
  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/finance/receivables/titles/${receivableId}/transactions`,
    'POST',
    { kind, amount, relatedTransactionId, proofDocumentId, notes },
  );
  if (result.kind !== 'ready')
    redirectWithError(`/financeiro/faturamento/${receivableId}`, result.message);
  revalidatePath('/financeiro/faturamento');
  revalidatePath(`/financeiro/faturamento/${receivableId}`);
  redirect(`/financeiro/faturamento/${receivableId}?transaction=1`);
}

export async function cancelCustomerReceivable(formData: FormData): Promise<void> {
  const receivableId = requireUuid(formString(formData, 'receivableId'));
  const reason = formString(formData, 'reason');
  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/finance/receivables/titles/${receivableId}/cancel`,
    'POST',
    { reason },
  );
  if (result.kind !== 'ready')
    redirectWithError(`/financeiro/faturamento/${receivableId}`, result.message);
  revalidatePath('/financeiro/faturamento');
  revalidatePath(`/financeiro/faturamento/${receivableId}`);
  redirect(`/financeiro/faturamento/${receivableId}?cancelled=1`);
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
    throw new Error('Identificador financeiro inválido.');
  }
  return value;
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message.slice(0, 240))}`);
}
