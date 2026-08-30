'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiSend } from '../../../_lib/api-client';
import {
  getEditableReferenceCatalog,
  type EditableReferenceCatalogSlug,
} from '../_lib/reference-catalog-config';

export type ReferenceCatalogSaveState = {
  readonly status: 'idle' | 'error';
  readonly message?: string;
};

export async function saveReferenceCatalog(
  _previousState: ReferenceCatalogSaveState,
  formData: FormData,
): Promise<ReferenceCatalogSaveState> {
  const catalog = formString(formData, 'catalog');
  const config = getEditableReferenceCatalog(catalog);
  if (!config) return errorState('Catálogo de referência inválido.');

  const mode = formString(formData, 'mode');
  if (mode !== 'create' && mode !== 'edit') return errorState('Modo de edição inválido.');

  const id = mode === 'edit' ? formString(formData, 'id') : null;
  if (mode === 'edit' && (!id || !isUuid(id))) {
    return errorState('Identificador do registro inválido.');
  }

  let body: Record<string, unknown>;
  try {
    body = catalogPayload(catalog as EditableReferenceCatalogSlug, formData);
  } catch (cause) {
    return errorState(
      cause instanceof FormInputError ? cause.message : 'Dados do formulário inválidos.',
    );
  }

  const endpoint =
    mode === 'create'
      ? `/api/v1/reference-data/${catalog}`
      : `/api/v1/reference-data/${catalog}/${id}`;
  const result = await apiSend<Record<string, unknown>>(
    endpoint,
    mode === 'create' ? 'POST' : 'PATCH',
    body,
  );

  if (result.kind !== 'ready') return errorState(result.message);

  revalidatePath(config.basePath);
  redirect(`${config.basePath}?saved=1`);
}

function catalogPayload(
  catalog: EditableReferenceCatalogSlug,
  formData: FormData,
): Record<string, unknown> {
  const common = {
    code: requiredText(formData, 'code', 'Código'),
    name: requiredText(formData, 'name', 'Nome'),
    isActive: booleanValue(formData, 'isActive', true),
  };

  switch (catalog) {
    case 'vehicle-types':
      return {
        ...common,
        description: optionalText(formData, 'description'),
        defaultMaxWeightKg: positiveNumberOrNull(formData, 'defaultMaxWeightKg'),
      };
    case 'body-types':
      return {
        ...common,
        description: optionalText(formData, 'description'),
        isClosed: booleanValue(formData, 'isClosed', false),
        supportsSideLoading: booleanValue(formData, 'supportsSideLoading', false),
        supportsRearLoading: booleanValue(formData, 'supportsRearLoading', false),
      };
    case 'cargo-types':
      return {
        ...common,
        description: optionalText(formData, 'description'),
        requiresSpecialHandling: booleanValue(formData, 'requiresSpecialHandling', false),
      };
    case 'package-types':
      return {
        ...common,
        description: optionalText(formData, 'description'),
        stackableDefault: nullableBooleanValue(formData, 'stackableDefault'),
      };
    case 'document-types':
      return {
        ...common,
        subjectScope: enumValue(formData, 'subjectScope', [
          'party',
          'driver',
          'asset',
          'request',
          'trip',
          'financial',
          'other',
        ]),
        hasExpiry: booleanValue(formData, 'hasExpiry', false),
        requiresValidation: booleanValue(formData, 'requiresValidation', false),
      };
    case 'tags':
      return {
        ...common,
        description: optionalText(formData, 'description'),
      };
  }
}

function formString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function requiredText(formData: FormData, field: string, label: string): string {
  const value = formString(formData, field);
  if (!value) throw new FormInputError(`${label} é obrigatório.`);
  return value;
}

function optionalText(formData: FormData, field: string): string | null {
  const value = formString(formData, field);
  return value || null;
}

function booleanValue(formData: FormData, field: string, fallback: boolean): boolean {
  const value = formString(formData, field);
  if (!value) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new FormInputError(`${field} possui valor booleano inválido.`);
}

function nullableBooleanValue(formData: FormData, field: string): boolean | null {
  const value = formString(formData, field);
  if (!value) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new FormInputError(`${field} possui valor booleano inválido.`);
}

function positiveNumberOrNull(formData: FormData, field: string): number | null {
  const value = formString(formData, field);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new FormInputError('Peso máximo padrão deve ser um número positivo.');
  }
  return parsed;
}

function enumValue(formData: FormData, field: string, allowed: readonly string[]): string {
  const value = formString(formData, field);
  if (!allowed.includes(value)) throw new FormInputError(`${field} possui valor inválido.`);
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function errorState(message: string): ReferenceCatalogSaveState {
  return { status: 'error', message };
}

class FormInputError extends Error {}
