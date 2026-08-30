'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiSend } from '../_lib/api-client';
import { getRecordConfig, type RecordMode, type RecordResource } from '../_lib/record-config';

export type RecordSaveState = {
  readonly status: 'idle' | 'error';
  readonly message?: string;
};

export async function saveOperationalRecord(
  _previousState: RecordSaveState,
  formData: FormData,
): Promise<RecordSaveState> {
  const resourceInput = formString(formData, 'resource');
  const config = getRecordConfig(resourceInput);
  if (!config) return errorState('Recurso de cadastro inválido.');
  const resource = resourceInput as RecordResource;

  const modeInput = formString(formData, 'mode');
  if (modeInput !== 'create' && modeInput !== 'edit') return errorState('Modo de edição inválido.');
  const mode = modeInput as RecordMode;
  if (mode === 'edit' && !config.supportsEdit)
    return errorState('Este recurso não suporta edição neste contrato.');

  const id = mode === 'edit' ? formString(formData, 'id') : '';
  if (mode === 'edit' && !isUuid(id)) return errorState('Identificador do registro inválido.');
  const subjectId = formString(formData, 'subjectId');

  let payload: Record<string, unknown>;
  try {
    payload = buildPayload(resource, mode, formData);
  } catch (cause) {
    return errorState(
      cause instanceof FormInputError ? cause.message : 'Dados do formulário inválidos.',
    );
  }

  const endpoint = endpointFor(resource, mode, config.endpoint, id, subjectId);
  if (!endpoint) return errorState('O contexto obrigatório do cadastro não foi informado.');
  const result = await apiSend<Record<string, unknown>>(
    endpoint,
    mode === 'edit' ? 'PATCH' : 'POST',
    payload,
  );
  if (result.kind !== 'ready') return errorState(result.message);

  revalidatePath(config.returnPath);
  const suffix =
    resource === 'party-requirement' && subjectId ? `?partyId=${subjectId}&saved=1` : '?saved=1';
  redirect(`${config.returnPath}${suffix}`);
}

function endpointFor(
  resource: RecordResource,
  mode: RecordMode,
  baseEndpoint: string,
  id: string,
  subjectId: string,
): string | null {
  if (resource === 'party-requirement') {
    return isUuid(subjectId)
      ? `/api/v1/master-data/business-parties/${subjectId}/requirements`
      : null;
  }
  return mode === 'edit' ? `${baseEndpoint}/${id}` : baseEndpoint;
}

function buildPayload(
  resource: RecordResource,
  mode: RecordMode,
  formData: FormData,
): Record<string, unknown> {
  switch (resource) {
    case 'party-client':
    case 'party-supplier':
    case 'party-carrier':
      return partyPayload(mode, formData);
    case 'driver':
      return {
        carrierPartyId: optionalText(formData, 'carrierPartyId'),
        fullName: requiredText(formData, 'fullName', 'Nome completo'),
        taxId: requiredText(formData, 'taxId', 'CPF'),
        email: optionalText(formData, 'email'),
        phone: requiredText(formData, 'phone', 'Telefone'),
        whatsapp: optionalText(formData, 'whatsapp'),
        cnhNumber: requiredText(formData, 'cnhNumber', 'Número da CNH'),
        cnhCategory: requiredText(formData, 'cnhCategory', 'Categoria CNH'),
        cnhExpiresOn: requiredText(formData, 'cnhExpiresOn', 'Validade CNH'),
        registrationStatus: requiredText(formData, 'registrationStatus', 'Situação cadastral'),
        operationalStatus: requiredText(formData, 'operationalStatus', 'Situação operacional'),
        statusReason: optionalText(formData, 'statusReason'),
      };
    case 'vehicle':
    case 'implement':
      return {
        carrierPartyId: optionalText(formData, 'carrierPartyId'),
        ownerPartyId: optionalText(formData, 'ownerPartyId'),
        ownerName: optionalText(formData, 'ownerName'),
        assetKind: resource === 'vehicle' ? 'vehicle' : 'implement',
        identifier: requiredText(formData, 'identifier', 'Identificador'),
        plate: optionalText(formData, 'plate'),
        vehicleType: requiredText(formData, 'vehicleType', 'Tipo de veículo'),
        bodyType: requiredText(formData, 'bodyType', 'Tipo de carroceria'),
        capacityWeightKg: positiveNumber(formData, 'capacityWeightKg', 'Capacidade de peso'),
        capacityVolumeM3: optionalPositiveNumber(formData, 'capacityVolumeM3'),
        maxLengthM: optionalPositiveNumber(formData, 'maxLengthM'),
        maxWidthM: optionalPositiveNumber(formData, 'maxWidthM'),
        maxHeightM: optionalPositiveNumber(formData, 'maxHeightM'),
        trackingAvailable: booleanValue(formData, 'trackingAvailable', false),
        status: requiredText(formData, 'status', 'Status'),
        statusReason: optionalText(formData, 'statusReason'),
      };
    case 'location':
      return {
        code: requiredText(formData, 'code', 'Código'),
        name: requiredText(formData, 'name', 'Nome'),
        type: requiredText(formData, 'type', 'Tipo'),
        partyId: null,
        addressId: null,
        cityId: requiredText(formData, 'cityId', 'Cidade'),
        postalCode: optionalText(formData, 'postalCode'),
        street: requiredText(formData, 'street', 'Logradouro'),
        number: optionalText(formData, 'number'),
        complement: optionalText(formData, 'complement'),
        district: optionalText(formData, 'district'),
        latitude: optionalNumber(formData, 'latitude'),
        longitude: optionalNumber(formData, 'longitude'),
        operationalReference: optionalText(formData, 'operationalReference'),
        isActive: booleanValue(formData, 'isActive', true),
      };
    case 'department':
    case 'cost-center':
      return {
        organizationId: requiredText(formData, 'organizationId', 'Organização'),
        businessUnitId: optionalText(formData, 'businessUnitId'),
        code: requiredText(formData, 'code', 'Código'),
        name: requiredText(formData, 'name', 'Nome'),
        isActive: booleanValue(formData, 'isActive', true),
      };
    case 'commodity':
      return {
        code: requiredText(formData, 'code', 'Código'),
        name: requiredText(formData, 'name', 'Nome'),
        description: optionalText(formData, 'description'),
        defaultCargoTypeId: optionalText(formData, 'defaultCargoTypeId'),
        isHazardous: booleanValue(formData, 'isHazardous', false),
        requiresTemperatureControl: booleanValue(formData, 'requiresTemperatureControl', false),
        isActive: booleanValue(formData, 'isActive', true),
      };
    case 'party-group':
      return {
        code: requiredText(formData, 'code', 'Código'),
        name: requiredText(formData, 'name', 'Nome'),
        groupType: requiredText(formData, 'groupType', 'Tipo de grupo'),
        isActive: booleanValue(formData, 'isActive', true),
      };
    case 'custom-field':
      return {
        entityType: requiredText(formData, 'entityType', 'Entidade'),
        key: requiredText(formData, 'key', 'Chave'),
        label: requiredText(formData, 'label', 'Rótulo'),
        dataType: requiredText(formData, 'dataType', 'Tipo de dado'),
        isRequired: booleanValue(formData, 'isRequired', false),
        validation: optionalJsonObject(formData, 'validation'),
        isActive: booleanValue(formData, 'isActive', true),
      };
    case 'party-requirement':
      return {
        requirementType: requiredText(formData, 'requirementType', 'Tipo do requisito'),
        value: requiredText(formData, 'value', 'Valor'),
        isMandatory: booleanValue(formData, 'isMandatory', true),
        validFrom: optionalText(formData, 'validFrom'),
        validUntil: optionalText(formData, 'validUntil'),
        isActive: booleanValue(formData, 'isActive', true),
      };
  }
}

function partyPayload(mode: RecordMode, formData: FormData): Record<string, unknown> {
  const roles = formData
    .getAll('roles')
    .filter((value): value is string => typeof value === 'string' && Boolean(value));
  if (roles.length === 0) throw new FormInputError('Selecione ao menos um papel para o parceiro.');
  const payload: Record<string, unknown> = {
    taxId: requiredText(formData, 'taxId', 'CPF/CNPJ'),
    legalName: requiredText(formData, 'legalName', 'Razão social / nome'),
    tradeName: optionalText(formData, 'tradeName'),
    email: optionalText(formData, 'email'),
    phone: optionalText(formData, 'phone'),
    roles,
  };
  if (roles.some((role) => ['carrier', 'partner', 'supplier'].includes(role))) {
    payload.homologationStatus = requiredText(formData, 'homologationStatus', 'Homologação');
    payload.homologationNotes = optionalText(formData, 'homologationNotes');
  }
  if (mode === 'edit') payload.status = requiredText(formData, 'status', 'Status');
  return payload;
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

function positiveNumber(formData: FormData, field: string, label: string): number {
  const value = formString(formData, field);
  const parsed = Number(value);
  if (!value || !Number.isFinite(parsed) || parsed <= 0) {
    throw new FormInputError(`${label} deve ser um número positivo.`);
  }
  return parsed;
}

function optionalPositiveNumber(formData: FormData, field: string): number | null {
  const value = formString(formData, field);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new FormInputError(`${field} deve ser um número positivo.`);
  }
  return parsed;
}

function optionalNumber(formData: FormData, field: string): number | null {
  const value = formString(formData, field);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new FormInputError(`${field} deve ser um número válido.`);
  return parsed;
}

function optionalJsonObject(formData: FormData, field: string): Record<string, unknown> | null {
  const value = formString(formData, field);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new FormInputError('Validação JSON deve ser um objeto.');
    }
    return parsed as Record<string, unknown>;
  } catch (cause) {
    if (cause instanceof FormInputError) throw cause;
    throw new FormInputError('Validação JSON não contém JSON válido.');
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function errorState(message: string): RecordSaveState {
  return { status: 'error', message };
}

class FormInputError extends Error {}
