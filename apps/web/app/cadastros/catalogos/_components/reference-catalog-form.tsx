'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import {
  saveReferenceCatalog,
  type ReferenceCatalogSaveState,
} from '../_actions/reference-catalog-actions';
import type {
  EditableReferenceCatalogConfig,
  ReferenceCatalogFormMode,
} from '../_lib/reference-catalog-config';

const initialState: ReferenceCatalogSaveState = { status: 'idle' };

export function ReferenceCatalogForm({
  config,
  mode,
  id,
  initialValues = {},
}: Readonly<{
  config: EditableReferenceCatalogConfig;
  mode: ReferenceCatalogFormMode;
  id?: string;
  initialValues?: Readonly<Record<string, string>>;
}>) {
  const [state, formAction, pending] = useActionState(saveReferenceCatalog, initialState);
  const isEdit = mode === 'edit';

  return (
    <div className="page-stack">
      <section className="page-hero operational-hero">
        <div>
          <span className="eyebrow">Catálogos • Wave 0015</span>
          <h1>{isEdit ? `Editar ${config.singular}` : `Novo ${config.singular}`}</h1>
          <p>{config.description}</p>
        </div>
        <Link href={config.basePath} className="button button-secondary">
          Voltar para lista
        </Link>
      </section>

      <form className="entity-form" action={formAction}>
        <input type="hidden" name="catalog" value={config.slug} />
        <input type="hidden" name="mode" value={mode} />
        {id ? <input type="hidden" name="id" value={id} /> : null}

        <div className="form-main">
          <section className="form-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Persistência real</span>
                <h2>Dados do catálogo</h2>
                <p>
                  Os dados são enviados por Server Action para a API protegida pelo TenantContext e
                  pelas políticas RLS existentes.
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
                      {field.options.map((option) => (
                        <option key={`${field.name}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={field.name}
                      type={field.type === 'number' ? 'number' : 'text'}
                      step={field.step}
                      min={field.type === 'number' ? '0' : undefined}
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
              <h2>Revise o cadastro</h2>
              <p>{state.message}</p>
            </section>
          ) : null}
        </div>

        <aside className="form-aside">
          <section className="form-summary-card">
            <span className="eyebrow">Governança</span>
            <h2>{isEdit ? 'Alteração controlada' : 'Cadastro controlado'}</h2>
            <p>
              O tenant não é enviado pelo formulário. Ele é resolvido exclusivamente pela API antes
              de acessar o PostgreSQL.
            </p>
            <ul className="check-list">
              <li>Validação server-side</li>
              <li>TenantContext obrigatório</li>
              <li>RLS no PostgreSQL</li>
              <li>Sem exclusão física</li>
              <li>Lifecycle via status ativo/inativo</li>
            </ul>
          </section>
          <div className="sticky-actions">
            <Link href={config.basePath} className="button button-secondary">
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
