'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiSend } from '../_lib/api-client';

export async function markInAppNotificationRead(formData: FormData): Promise<void> {
  const notificationId = requireUuid(formString(formData, 'notificationId'));
  const result = await apiSend<Record<string, unknown>>(
    `/api/v1/notifications/${notificationId}/read`,
    'PATCH',
    {},
  );
  if (result.kind !== 'ready') {
    redirect(`/notificacoes?error=${encodeURIComponent(result.message.slice(0, 240))}`);
  }
  revalidatePath('/notificacoes');
  redirect('/notificacoes?read=1');
}

function formString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function requireUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Identificador de notificação inválido.');
  }
  return value;
}
