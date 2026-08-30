'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { saveOperationalRecord, type RecordSaveState } from '../_actions/record-actions';
import type { RecordConfig, RecordMode } from '../_lib/record-config';

const initialState: RecordSaveState = { status: 'idle' };

type InitialValue = string | readonly string[];

export function RecordForm({
  config,
  mode,
  id,
  subjectId,
  initialValues = {},
}: Readonly<{
  config: RecordConfig;
  mode: RecordMode;
  id?: string;
  subjectId?: string;
  initialValues?: Readonly<Record<string, InitialValue>>;
}>) {
  const [state, formAction, pending] = useActionState(saveOperationalRecord, initialState);
  const isEdit = mode === 'edit';

  return (
    <div className="page-stack">
      <section className="page-hero operational-hero">
        <div>
          <span className="eyebrow">Cadastros • Dados reais</span>
          <h1>{isEdit ? `Editar ${config.singular}` : `Novo ${config.singular}`}</h1>
          <p>{config.description}</p>
        </div>
        <Link
          href={returnHref(config.returnPath, config.resource, subjectId)}
          className="button button-secondary"
        >
          Voltar para lista
        </Link>
      </section>

      <form className="entity-form" action={formAction}>
        <input type="hidden" name="resource" value={config.resource} />
        <input type="hidden" name="mode" value={mode} />
        {id ? <input type="hidden" name="id" value={id} /> : null}
        {subjectId ? <input type="hidden" name="subjectId" value={subjectId} /> : null}

        <div className="form-main">
          <section className="form-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Contrato protegido</span>
                <h2>Dados do cadastro</h2>
                <p>
                  O formulário envia somente campos whitelisted para a Server Action e para a API
                  tenant-aware.
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
                      defaultValue={scalarInitial(initialValues[field.name], field.defaultValue)}
                      required={field.required}
                    >
                      {field.options.map((option) => (
                        <option key={`${field.name}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox-group' && field.options ? (
                    <div className="check-list">
                      {field.options.map((option) => (
                        <label key={`${field.name}-${option.value}`}>
                          <input
                            type="checkbox"
                            name={field.name}
                            value={option.value}
                            defaultChecked={arrayInitial(initialValues[field.name]).includes(
                              option.value,
                            )}
                          />{' '}
                          {option.label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      name={field.name}
                      type={
                        field.type === 'number'
                          ? 'number'
                          : field.type === 'date'
                            ? 'date'
                            : field.type === 'email'
                              ? 'email'
                              : field.type === 'tel'
                                ? 'tel'
                                : 'text'
                      }
                      step={field.step}
                      placeholder={field.placeholder}
                      required={field.required}
                      defaultValue={scalarInitial(initialValues[field.name], field.defaultValue)}
                    />
                  )}
                </label>
              ))}
            </div>
          </section>

          {state.status === 'error' ? (
            <section className="form-summary-card" aria-live="polite">
              <span className="eyebrow">Não foi possível salvar</span>
              <h2>Revise o cadastro</h2>
              <p>{state.message}</p>
            </section>
          ) : null}
        </div>

        <aside className="form-aside">
          <section className="form-summary-card">
            <span className="eyebrow">Governança</span>
            <h2>Persistência tenant-aware</h2>
            <p>
              Tenant e usuário não são controlados pelo formulário. A API resolve o contexto
              autenticado antes do PostgreSQL.
            </p>
            <ul className="check-list">
              <li>Payload explicitamente whitelisted</li>
              <li>TenantRuntimeGateGuard na API</li>
              <li>TenantContext + RLS</li>
              <li>Validação de domínio no backend</li>
              <li>Sem exclusão física implícita</li>
            </ul>
          </section>
          <div className="sticky-actions">
            <Link
              href={returnHref(config.returnPath, config.resource, subjectId)}
              className="button button-secondary"
            >
              Cancelar
            </Link>
            <button type="submit" className="button button-primary" disabled={pending}>
              {pending ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar cadastro'}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}

function scalarInitial(value: InitialValue | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function arrayInitial(value: InitialValue | undefined): readonly string[] {
  return Array.isArray(value) ? value : [];
}

function returnHref(path: string, resource: string, subjectId?: string): string {
  return resource === 'party-requirement' && subjectId ? `${path}?partyId=${subjectId}` : path;
}
