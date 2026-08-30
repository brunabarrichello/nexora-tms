'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import {
  archiveDocument,
  createDocument,
  linkDocument,
  updateDocument,
  validateDocument,
  type DocumentActionState,
} from '../_actions/document-actions';
import type {
  DocumentRecord,
  DocumentTargetKind,
  DocumentTargetOption,
  ReferenceDocumentType,
} from '../_lib/document-ui';

const initialState: DocumentActionState = { status: 'idle' };

export function DocumentCreateForm({
  documentTypes,
}: Readonly<{ documentTypes: readonly ReferenceDocumentType[] }>) {
  const [state, action, pending] = useActionState(createDocument, initialState);
  return (
    <DocumentFormShell
      title="Novo documento"
      description="Crie o aggregate documental; versões, validações e vínculos são históricos separados."
      backHref="/documentos"
      action={action}
      state={state}
      pending={pending}
      submitLabel="Criar documento"
      governance={[
        'Tenant e usuário resolvidos no backend',
        'Tipo vindo do catálogo oficial',
        'Soft delete no aggregate root',
        'Metadata JSON sob contrato explícito',
      ]}
    >
      <Field label="Tipo documental *" wide>
        <select name="documentTypeId" defaultValue="" required>
          <option value="" disabled>
            Selecione
          </option>
          {documentTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {String(type.code ?? '')} • {type.name} • {String(type.subjectScope ?? 'other')}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Título *" wide>
        <input name="title" required placeholder="Ex.: Apólice 2026 / CT-e 12345" />
      </Field>
      <Field label="Referência externa">
        <input name="externalReference" placeholder="Chave, número ou referência externa" />
      </Field>
      <Field label="Emissão">
        <input name="issuedOn" type="date" />
      </Field>
      <Field label="Validade">
        <input name="expiresOn" type="date" />
      </Field>
      <Field label="Metadados JSON" wide>
        <textarea name="metadata" rows={7} defaultValue="{}" />
      </Field>
      <Field label="Observações" wide>
        <textarea name="notes" rows={5} />
      </Field>
    </DocumentFormShell>
  );
}

export function DocumentEditForm({ document }: Readonly<{ document: DocumentRecord }>) {
  const [state, action, pending] = useActionState(updateDocument, initialState);
  const id = String(document.id ?? '');
  return (
    <DocumentFormShell
      title="Editar documento"
      description="Atualize somente os metadados mutáveis do aggregate documental."
      backHref={`/documentos/${id}`}
      action={action}
      state={state}
      pending={pending}
      submitLabel="Salvar alterações"
      governance={[
        'Tipo documental permanece imutável',
        'Versões não são sobrescritas',
        'Validações permanecem append-only',
        'Alteração respeita a política de expiração do tipo',
      ]}
    >
      <input type="hidden" name="documentId" value={id} />
      <Field label="Título *" wide>
        <input name="title" required defaultValue={text(document.title)} />
      </Field>
      <Field label="Referência externa">
        <input name="externalReference" defaultValue={text(document.external_reference)} />
      </Field>
      <Field label="Emissão">
        <input name="issuedOn" type="date" defaultValue={dateValue(document.issued_on)} />
      </Field>
      <Field label="Validade">
        <input name="expiresOn" type="date" defaultValue={dateValue(document.expires_on)} />
      </Field>
      <Field label="Metadados JSON" wide>
        <textarea name="metadata" rows={7} defaultValue={jsonValue(document.metadata)} />
      </Field>
      <Field label="Observações" wide>
        <textarea name="notes" rows={5} defaultValue={text(document.notes)} />
      </Field>
    </DocumentFormShell>
  );
}

export function DocumentValidationForm({
  documentId,
  versions,
}: Readonly<{ documentId: string; versions: readonly DocumentRecord[] }>) {
  const [state, action, pending] = useActionState(validateDocument, initialState);
  return (
    <DocumentFormShell
      title="Registrar validação"
      description="Acrescente uma decisão imutável e deixe o backend recalcular o status documental."
      backHref={`/documentos/${documentId}?view=validations`}
      action={action}
      state={state}
      pending={pending}
      submitLabel="Registrar validação"
      governance={[
        'Validação append-only',
        'Versão opcional vinculada por FK',
        'Usuário validador resolvido pelo backend',
        'Status do documento derivado pelo domínio',
      ]}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <Field label="Versão">
        <select name="documentVersionId" defaultValue="">
          <option value="">Documento como um todo</option>
          {versions.map((version) => (
            <option key={String(version.id)} value={String(version.id)}>
              v{String(version.version_number)} • {String(version.original_file_name ?? 'arquivo')}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tipo de validação *">
        <select name="validationType" defaultValue="manual" required>
          <option value="manual">Manual</option>
          <option value="system">Sistema</option>
          <option value="external">Externa</option>
        </select>
      </Field>
      <Field label="Resultado *">
        <select name="result" defaultValue="valid" required>
          <option value="valid">Válido</option>
          <option value="invalid">Inválido</option>
          <option value="review_required">Revisão necessária</option>
        </select>
      </Field>
      <Field label="Referência do provider">
        <input name="providerReference" />
      </Field>
      <Field label="Detalhes JSON" wide>
        <textarea name="details" rows={7} defaultValue="{}" />
      </Field>
      <Field label="Observações" wide>
        <textarea name="notes" rows={5} />
      </Field>
    </DocumentFormShell>
  );
}

export function DocumentLinkForm({
  documentId,
  subjectScope,
  targets,
}: Readonly<{
  documentId: string;
  subjectScope: string;
  targets: readonly DocumentTargetOption[];
}>) {
  const [state, action, pending] = useActionState(linkDocument, initialState);
  const compatible = targets.filter(
    (target) => subjectScope === 'other' || target.kind === subjectScope,
  );
  const canLink = compatible.length > 0;
  return (
    <DocumentFormShell
      title="Vincular documento"
      description={`Selecione uma entidade real compatível com o escopo ${subjectScope}.`}
      backHref={`/documentos/${documentId}`}
      action={action}
      state={state}
      pending={pending}
      submitLabel="Criar vínculo"
      submitDisabled={!canLink}
      governance={[
        'Endpoint especializado por aggregate root',
        'FK tenant-aware no banco',
        'Escopo do document type validado novamente no backend',
        'Sem vínculo polimórfico genérico',
      ]}
    >
      <input type="hidden" name="documentId" value={documentId} />
      {canLink ? (
        <Field label="Entidade *" wide>
          <select name="targetChoice" defaultValue="" required onChange={copyTargetSelection}>
            <option value="" disabled>
              Selecione
            </option>
            {compatible.map((target) => (
              <option key={`${target.kind}:${target.id}`} value={`${target.kind}:${target.id}`}>
                {targetKindLabel(target.kind)} • {target.label}
              </option>
            ))}
          </select>
          <input type="hidden" name="targetKind" />
          <input type="hidden" name="targetId" />
        </Field>
      ) : (
        <section className="form-summary-card field-wide">
          <strong>Nenhuma entidade compatível está disponível</strong>
          <p>
            O backend preserva integridade referencial. Para escopos ainda sem aggregate root ou sem
            registros, o vínculo permanece indisponível em vez de aceitar UUID arbitrário.
          </p>
        </section>
      )}
      {(subjectScope === 'party' || subjectScope === 'request' || subjectScope === 'other') && (
        <Field label="Relação">
          <select
            name="relationType"
            defaultValue={subjectScope === 'request' ? 'request' : 'registration'}
          >
            {relationOptions(subjectScope).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
      )}
    </DocumentFormShell>
  );
}

export function DocumentArchiveForm({ documentId }: Readonly<{ documentId: string }>) {
  const [state, action, pending] = useActionState(archiveDocument, initialState);
  return (
    <DocumentFormShell
      title="Arquivar documento"
      description="Soft delete auditável: o registro deixa as consultas ativas sem perder histórico."
      backHref={`/documentos/${documentId}`}
      action={action}
      state={state}
      pending={pending}
      submitLabel="Arquivar documento"
      governance={[
        'Nenhum DELETE físico',
        'Motivo obrigatório',
        'Usuário e data persistidos pelo backend',
      ]}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <Field label="Motivo *" wide>
        <textarea name="reason" rows={6} required />
      </Field>
    </DocumentFormShell>
  );
}

function copyTargetSelection(event: React.ChangeEvent<HTMLSelectElement>): void {
  const form = event.currentTarget.form;
  if (!form) return;
  const [kind, id] = event.currentTarget.value.split(':');
  const kindInput = form.elements.namedItem('targetKind');
  const idInput = form.elements.namedItem('targetId');
  if (kindInput instanceof HTMLInputElement) kindInput.value = kind ?? '';
  if (idInput instanceof HTMLInputElement) idInput.value = id ?? '';
}

function relationOptions(scope: string): readonly string[] {
  if (scope === 'request') return ['request', 'commercial', 'compliance', 'reference', 'other'];
  if (scope === 'party') return ['registration', 'compliance', 'contract', 'insurance', 'other'];
  return [
    'registration',
    'compliance',
    'contract',
    'insurance',
    'request',
    'commercial',
    'reference',
    'other',
  ];
}

function targetKindLabel(kind: DocumentTargetKind): string {
  return ({ party: 'Parceiro', driver: 'Motorista', asset: 'Ativo', request: 'Carga' } as const)[
    kind
  ];
}

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function dateValue(value: unknown): string {
  return value ? String(value).slice(0, 10) : '';
}

function jsonValue(value: unknown): string {
  if (!value || typeof value !== 'object') return '{}';
  return JSON.stringify(value, null, 2);
}

function Field({
  label,
  wide = false,
  children,
}: Readonly<{ label: string; wide?: boolean; children: React.ReactNode }>) {
  return (
    <label className={`form-field ${wide ? 'field-wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function DocumentFormShell({
  title,
  description,
  backHref,
  action,
  state,
  pending,
  submitLabel,
  submitDisabled = false,
  governance,
  children,
}: Readonly<{
  title: string;
  description: string;
  backHref: string;
  action: (formData: FormData) => void;
  state: DocumentActionState;
  pending: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
  governance: readonly string[];
  children: React.ReactNode;
}>) {
  return (
    <div className="page-stack">
      <section className="page-hero operational-hero">
        <div>
          <span className="eyebrow">Documents • Wave 0018</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <Link href={backHref} className="button button-secondary">
          Voltar
        </Link>
      </section>
      <form className="entity-form" action={action}>
        <div className="form-main">
          <section className="form-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Contrato canônico</span>
                <h2>Dados documentais</h2>
                <p>Somente campos aceitos pela API oficial da Wave 0018 são enviados.</p>
              </div>
            </div>
            <div className="field-grid">{children}</div>
          </section>
          {state.status === 'error' ? (
            <section className="form-summary-card" aria-live="polite">
              <span className="eyebrow">Não foi possível salvar</span>
              <h2>Revise a operação</h2>
              <p>{state.message}</p>
            </section>
          ) : null}
        </div>
        <aside className="form-aside">
          <section className="form-summary-card">
            <span className="eyebrow">Governança</span>
            <h2>Tenant-aware e auditável</h2>
            <ul className="check-list">
              {governance.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <div className="sticky-actions">
            <Link href={backHref} className="button button-secondary">
              Cancelar
            </Link>
            <button
              type="submit"
              className="button button-primary"
              disabled={pending || submitDisabled}
            >
              {pending ? 'Salvando…' : submitLabel}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}
