'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import {
  saveQualificationRecord,
  type QualificationSaveState,
} from '../_actions/qualification-actions';
import type { QualificationConfig } from '../_lib/qualification-config';

const initialState: QualificationSaveState = { status: 'idle' };

export function QualificationForm({
  config,
  subjectId,
  maintenanceId,
  initialValues = {},
}: Readonly<{
  config: QualificationConfig;
  subjectId: string;
  maintenanceId?: string;
  initialValues?: Readonly<Record<string, string>>;
}>) {
  const [state, formAction, pending] = useActionState(saveQualificationRecord, initialState);
  const returnHref = buildReturnHref(config, subjectId, maintenanceId);

  return (
    <div className="page-stack">
      <section className="page-hero operational-hero">
        <div>
          <span className="eyebrow">Capacity • Wave 0017</span>
          <h1>
            {config.method === 'PUT' ? `Configurar ${config.singular}` : `Novo ${config.singular}`}
          </h1>
          <p>{config.description}</p>
        </div>
        <Link href={returnHref} className="button button-secondary">
          Voltar para lista
        </Link>
      </section>

      <form className="entity-form" action={formAction}>
        <input type="hidden" name="resource" value={config.resource} />
        <input type="hidden" name="scope" value={config.scope} />
        <input type="hidden" name="subjectId" value={subjectId} />
        {maintenanceId ? <input type="hidden" name="maintenanceId" value={maintenanceId} /> : null}

        <div className="form-main">
          <section className="form-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Contrato protegido</span>
                <h2>Dados operacionais</h2>
                <p>
                  Somente campos previstos pelo contrato Wave 0017 são enviados à API tenant-aware.
                </p>
              </div>
            </div>
            <div className="field-grid">
              {config.fields.map((field) => (
                <label className={`form-field ${field.wide ? 'field-wide' : ''}`} key={field.name}>
                  <span>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </span>
                  {field.type === 'select' && field.options ? (
                    <select
                      name={field.name}
                      defaultValue={initialValues[field.name] ?? field.defaultValue ?? ''}
                      required={field.required}
                    >
                      {!field.required ? <option value="">Não informado</option> : null}
                      {field.options.map((option) => (
                        <option key={`${field.name}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'boolean' ? (
                    <select
                      name={field.name}
                      defaultValue={initialValues[field.name] ?? field.defaultValue ?? 'false'}
                    >
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  ) : field.type === 'json' ? (
                    <textarea
                      name={field.name}
                      rows={8}
                      defaultValue={initialValues[field.name] ?? field.defaultValue ?? '{}'}
                      required={field.required}
                    />
                  ) : (
                    <input
                      name={field.name}
                      type={
                        field.type === 'number'
                          ? 'number'
                          : field.type === 'date'
                            ? 'date'
                            : field.type === 'datetime'
                              ? 'datetime-local'
                              : 'text'
                      }
                      step={field.step}
                      placeholder={field.placeholder}
                      required={field.required}
                      defaultValue={initialValues[field.name] ?? field.defaultValue ?? ''}
                    />
                  )}
                </label>
              ))}
            </div>
          </section>

          {state.status === 'error' ? (
            <section className="form-summary-card" aria-live="polite">
              <span className="eyebrow">Não foi possível salvar</span>
              <h2>Revise o registro</h2>
              <p>{state.message}</p>
            </section>
          ) : null}
        </div>

        <aside className="form-aside">
          <section className="form-summary-card">
            <span className="eyebrow">Governança</span>
            <h2>Wave 0017 tenant-aware</h2>
            <p>
              O motorista/ativo é definido pela rota. Tenant e usuário continuam resolvidos pelo
              backend e nunca são recebidos como campos editáveis.
            </p>
            <ul className="check-list">
              <li>TenantRuntimeGateGuard</li>
              <li>TenantContext + RLS</li>
              <li>Payload whitelisted</li>
              <li>Validação de domínio no backend</li>
              <li>Históricos append-only preservados</li>
            </ul>
          </section>
          <div className="sticky-actions">
            <Link href={returnHref} className="button button-secondary">
              Cancelar
            </Link>
            <button type="submit" className="button button-primary" disabled={pending}>
              {pending
                ? 'Salvando…'
                : config.method === 'PUT'
                  ? 'Salvar configuração'
                  : 'Adicionar registro'}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}

function buildReturnHref(
  config: QualificationConfig,
  subjectId: string,
  maintenanceId?: string,
): string {
  const params = new URLSearchParams();
  params.set(config.scope === 'driver' ? 'driverId' : 'assetId', subjectId);
  if (maintenanceId) params.set('maintenanceId', maintenanceId);
  return `${config.returnPath}?${params.toString()}`;
}
