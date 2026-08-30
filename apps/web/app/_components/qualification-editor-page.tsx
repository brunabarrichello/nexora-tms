import Link from 'next/link';
import { notFound } from 'next/navigation';

import { QualificationForm } from './qualification-form';
import { apiGet } from '../_lib/api-client';
import {
  qualificationConfigs,
  qualificationEndpoint,
  type QualificationResource,
  type QualificationScope,
} from '../_lib/qualification-config';

type QualificationRecord = Readonly<Record<string, unknown>>;

export async function QualificationEditorPage({
  scope,
  subjectId,
  resource,
  maintenanceId,
}: Readonly<{
  scope: QualificationScope;
  subjectId: string;
  resource: string;
  maintenanceId?: string;
}>) {
  if (!(resource in qualificationConfigs)) notFound();
  const config = qualificationConfigs[resource as QualificationResource];
  if (config.scope !== scope) notFound();
  if (config.requiresMaintenance && !maintenanceId) notFound();

  let initialValues: Record<string, string> = {};
  if (config.singleton) {
    const result = await apiGet<QualificationRecord>(
      qualificationEndpoint(config, subjectId, maintenanceId),
    );
    if (result.kind === 'ready') {
      initialValues = config.fields.reduce<Record<string, string>>((accumulator, field) => {
        const value = result.data[camelToSnake(field.name)];
        accumulator[field.name] = fieldValue(value, field.type);
        return accumulator;
      }, {});
    } else if (
      result.kind !== 'error' ||
      !result.message.toLowerCase().includes('not found')
    ) {
      return (
        <div className="page-stack">
          <section className="system-state">
            <span className="eyebrow">Capacity • Wave 0017</span>
            <h1>Não foi possível carregar a configuração</h1>
            <p>{result.message}</p>
            <Link href={returnHref(config.returnPath, scope, subjectId, maintenanceId)} className="button button-secondary">
              Voltar
            </Link>
          </section>
        </div>
      );
    }
  }

  return (
    <QualificationForm
      config={config}
      subjectId={subjectId}
      maintenanceId={maintenanceId}
      initialValues={initialValues}
    />
  );
}

function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function fieldValue(value: unknown, type: string | undefined): string {
  if (value === undefined || value === null) return '';
  if (type === 'boolean') return value === true ? 'true' : 'false';
  if (type === 'json') return JSON.stringify(value, null, 2);
  if (type === 'datetime') {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
  }
  if (type === 'date') return String(value).slice(0, 10);
  return String(value);
}

function returnHref(
  path: string,
  scope: QualificationScope,
  subjectId: string,
  maintenanceId?: string,
): string {
  const params = new URLSearchParams();
  params.set(scope === 'driver' ? 'driverId' : 'assetId', subjectId);
  if (maintenanceId) params.set('maintenanceId', maintenanceId);
  return `${path}?${params.toString()}`;
}
