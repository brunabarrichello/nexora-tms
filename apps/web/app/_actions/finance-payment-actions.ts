'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiSend } from '../_lib/api-client';

export async function createCarrierPaymentObligation(formData: FormData): Promise<void> {
  const transportContractId = formString(formData, 'transportContractId');
  const tripId = optionalString(formData, 'tripId');
  const dueDate = formString(formData, 'dueDate');
  const notes = optionalString(formData, 'notes');

  const result = await apiSend<{ id: string }>('/api/v1/finance/payments/obligations', 'POST', {
    transportContractId,
    tripId,
    dueAt: dueDate ? `${dueDate}T12:00:00.000Z` : '',
    notes,
  });

  if (result.kind !== 'ready') redirectWithError('/financeiro/pagamentos', result.message);
  revalidatePath('/financeiro/pagamentos');
  redirect(`/financeiro/pagamentos/${result.data.id}?created=1`);
}

export async function updateCarrierPaymentObligation(formData: FormData): Promise<void> {
  const obligationId = requireUuid(formString(formData, 'obligationId'));
  const dueDate = formString(formData, 'dueDate');
  const tripId = optionalString(formData, 'tripId');
  const notes = optionalString(formData, 'notes');

  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/finance/payments/obligations/${obligationId}`,
    'PATCH',
    {
      dueAt: dueDate ? `${dueDate}T12:00:00.000Z` : undefined,
      tripId,
      notes,
    },
  );
  if (result.kind !== 'ready') {
    redirectWithError(`/financeiro/pagamentos/${obligationId}`, result.message);
  }
  revalidatePath('/financeiro/pagamentos');
  revalidatePath(`/financeiro/pagamentos/${obligationId}`);
  redirect(`/financeiro/pagamentos/${obligationId}?updated=1`);
}

export async function recordCarrierPaymentTransaction(formData: FormData): Promise<void> {
  const obligationId = requireUuid(formString(formData, 'obligationId'));
  const kind = formString(formData, 'kind');
  const amount = formString(formData, 'amount');
  const relatedTransactionId = optionalString(formData, 'relatedTransactionId');
  const proofDocumentId = optionalString(formData, 'proofDocumentId');
  const notes = optionalString(formData, 'notes');

  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/finance/payments/obligations/${obligationId}/transactions`,
    'POST',
    { kind, amount, relatedTransactionId, proofDocumentId, notes },
  );
  if (result.kind !== 'ready') {
    redirectWithError(`/financeiro/pagamentos/${obligationId}`, result.message);
  }
  revalidatePath('/financeiro/pagamentos');
  revalidatePath(`/financeiro/pagamentos/${obligationId}`);
  redirect(`/financeiro/pagamentos/${obligationId}?transaction=1`);
}

export async function cancelCarrierPaymentObligation(formData: FormData): Promise<void> {
  const obligationId = requireUuid(formString(formData, 'obligationId'));
  const reason = formString(formData, 'reason');
  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/finance/payments/obligations/${obligationId}/cancel`,
    'POST',
    { reason },
  );
  if (result.kind !== 'ready') {
    redirectWithError(`/financeiro/pagamentos/${obligationId}`, result.message);
  }
  revalidatePath('/financeiro/pagamentos');
  revalidatePath(`/financeiro/pagamentos/${obligationId}`);
  redirect(`/financeiro/pagamentos/${obligationId}?cancelled=1`);
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
  const safe = encodeURIComponent(message.slice(0, 240));
  redirect(`${path}?error=${safe}`);
}
