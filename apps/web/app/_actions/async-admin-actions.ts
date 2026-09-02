'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiSend } from '../_lib/api-client';

export async function reprocessOutboxEvent(formData: FormData): Promise<void> {
  const eventId = requireUuid(formString(formData, 'eventId'), 'evento');
  const reason = requireReason(formString(formData, 'reason'));
  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/admin/async/outbox/${eventId}/reprocess`,
    'POST',
    { reason },
  );
  if (result.kind !== 'ready') {
    redirect(`/administracao/integracoes/processamento?error=${encodeURIComponent(result.message.slice(0, 240))}`);
  }
  revalidatePath('/administracao/integracoes/processamento');
  redirect('/administracao/integracoes/processamento?reprocessed=outbox');
}

export async function reprocessDurableJob(formData: FormData): Promise<void> {
  const jobId = requireUuid(formString(formData, 'jobId'), 'job');
  const reason = requireReason(formString(formData, 'reason'));
  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/admin/async/jobs/${jobId}/reprocess`,
    'POST',
    { reason },
  );
  if (result.kind !== 'ready') {
    redirect(`/administracao/integracoes/processamento?error=${encodeURIComponent(result.message.slice(0, 240))}`);
  }
  revalidatePath('/administracao/integracoes/processamento');
  redirect('/administracao/integracoes/processamento?reprocessed=job');
}

function formString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function requireUuid(value: string, label: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Identificador de ${label} inválido.`);
  }
  return value;
}

function requireReason(value: string): string {
  if (value.length < 3 || value.length > 500) {
    throw new Error('O motivo do reprocessamento deve ter entre 3 e 500 caracteres.');
  }
  return value;
}
