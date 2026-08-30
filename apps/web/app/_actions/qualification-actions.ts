'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiSend } from '../_lib/api-client';
import {
  qualificationConfigs,
  qualificationEndpoint,
  type QualificationConfig,
  type QualificationField,
  type QualificationResource,
  type QualificationScope,
} from '../_lib/qualification-config';

export type QualificationSaveState =
  { readonly status: 'idle' } | { readonly status: 'error'; readonly message: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveQualificationRecord(
  _previous: QualificationSaveState,
  formData: FormData,
): Promise<QualificationSaveState> {
  try {
    const resource = requireResource(formData.get('resource'));
    const config = qualificationConfigs[resource];
    const scope = requireScope(formData.get('scope'));
    if (scope !== config.scope) throw new Error('Escopo de qualificação inválido.');
    const subjectId = requireUuidValue(
      formData.get('subjectId'),
      scope === 'driver' ? 'driverId' : 'assetId',
    );
    const maintenanceId = config.requiresMaintenance
      ? requireUuidValue(formData.get('maintenanceId'), 'maintenanceId')
      : undefined;
    const payload = payloadFromForm(config, formData);
    const result = await apiSend<Record<string, unknown>>(
      qualificationEndpoint(config, subjectId, maintenanceId),
      config.method,
      payload,
    );
    if (result.kind !== 'ready') return { status: 'error', message: result.message };

    revalidatePath(config.returnPath);
    redirect(returnHref(config, subjectId, maintenanceId, true));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Não foi possível validar o formulário.',
    };
  }
}

export async function releaseQualificationBlock(
  _previous: QualificationSaveState,
  formData: FormData,
): Promise<QualificationSaveState> {
  try {
    const resource = requireResource(formData.get('resource'));
    if (resource !== 'driver-block' && resource !== 'asset-block') {
      throw new Error('Somente bloqueios podem ser liberados por esta ação.');
    }
    const config = qualificationConfigs[resource];
    const subjectId = requireUuidValue(
      formData.get('subjectId'),
      config.scope === 'driver' ? 'driverId' : 'assetId',
    );
    const blockId = requireUuidValue(formData.get('blockId'), 'blockId');
    const releaseReason = textValue(formData.get('releaseReason'));
    if (!releaseReason) throw new Error('Informe o motivo da liberação.');
    const root = config.scope === 'driver' ? 'drivers' : 'assets';
    const result = await apiSend<Record<string, unknown>>(
      `/api/v1/capacity/${root}/${subjectId}/blocks/${blockId}/release`,
      'POST',
      { releaseReason },
    );
    if (result.kind !== 'ready') return { status: 'error', message: result.message };
    revalidatePath(config.returnPath);
    redirect(returnHref(config, subjectId, undefined, true));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Não foi possível liberar o bloqueio.',
    };
  }
}

function payloadFromForm(config: QualificationConfig, formData: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of config.fields) {
    const raw = formData.get(field.name);
    payload[field.name] = normalizeField(field, raw);
  }
  return payload;
}

function normalizeField(field: QualificationField, value: FormDataEntryValue | null): unknown {
  const text = textValue(value);
  if (!text) {
    if (field.required) throw new Error(`${field.label} é obrigatório.`);
    if (field.type === 'boolean') return false;
    if (field.type === 'json') return {};
    return null;
  }

  switch (field.type) {
    case 'number': {
      const parsed = Number(text);
      if (!Number.isFinite(parsed)) throw new Error(`${field.label} deve ser numérico.`);
      return parsed;
    }
    case 'boolean':
      if (text !== 'true' && text !== 'false')
        throw new Error(`${field.label} deve ser Sim ou Não.`);
      return text === 'true';
    case 'json':
      try {
        const parsed = JSON.parse(text) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error();
        }
        return parsed;
      } catch {
        throw new Error(`${field.label} deve conter um objeto JSON válido.`);
      }
    case 'datetime': {
      const parsed = new Date(text);
      if (Number.isNaN(parsed.getTime()))
        throw new Error(`${field.label} deve conter data/hora válida.`);
      return parsed.toISOString();
    }
    case 'date':
    case 'select':
    case 'text':
    default:
      return text;
  }
}

function returnHref(
  config: QualificationConfig,
  subjectId: string,
  maintenanceId?: string,
  saved = false,
): string {
  const params = new URLSearchParams();
  params.set(config.scope === 'driver' ? 'driverId' : 'assetId', subjectId);
  if (maintenanceId) params.set('maintenanceId', maintenanceId);
  if (saved) params.set('saved', '1');
  return `${config.returnPath}?${params.toString()}`;
}

function requireResource(value: FormDataEntryValue | null): QualificationResource {
  const resource = textValue(value) as QualificationResource;
  if (!(resource in qualificationConfigs))
    throw new Error('Recurso de qualificação não suportado.');
  return resource;
}

function requireScope(value: FormDataEntryValue | null): QualificationScope {
  const scope = textValue(value);
  if (scope !== 'driver' && scope !== 'asset') throw new Error('Escopo inválido.');
  return scope;
}

function requireUuidValue(value: FormDataEntryValue | null, label: string): string {
  const normalized = textValue(value);
  if (!uuidPattern.test(normalized)) throw new Error(`${label} deve ser um UUID válido.`);
  return normalized;
}

function textValue(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
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
