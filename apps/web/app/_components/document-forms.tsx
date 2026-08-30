'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import {
  createDocument,
  createDocumentLink,
  createDocumentValidation,
  createDocumentVersion,
  unlinkDocumentLink,
  type DocumentSaveState,
} from '../_actions/document-actions';
import type { ReferenceDocumentType } from '../_lib/document-ui';

const initialState: DocumentSaveState = { status: 'idle' };

type VersionOption = { readonly id: string; readonly label: string };
export type DocumentLinkTargetOption = {
  readonly kind: string;
  readonly id: string;
  readonly label: string;
};

const targetLabels: Readonly<Record<string, string>> = {
  party: 'Business party',
  driver: 'Motorista',
  driver_document: 'Registro documental de motorista',
  asset: 'Ativo',
  asset_document: 'Registro documental de ativo',
  request: 'Carga / solicitação',
  contract: 'Contrato de transporte',
};

export function DocumentCreateForm({
  documentTypes,
}: Readonly<{ documentTypes: readonly ReferenceDocumentType[] }>) {
  const [state, action, pending] = useActionState(createDocument, initialState);
  return (
    <DocumentFormShell
      title="Novo documento"
      description="Crie o documento lógico. Arquivos entram depois como versões imutáveis."
      backHref="/documentos"
      state={state}
      pending={pending}
      submitLabel="Criar documento"
      action={action}
      governance={[
        'Tenant e usuário resolvidos pelo backend',
        'Tipo documental vindo do catálogo oficial',
        'Estado inicial protegido pelo domínio',
        'Nenhum binário ou segredo trafega neste formulário',
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
        <input name="title" required placeholder="Ex.: CT-e 12345 / Contrato de transporte" />
      </Field>
      <Field label="Número / referência">
        <input name="documentNumber" />
      </Field>
      <Field label="Emissor">
        <input name="issuer" />
      </Field>
      <Field label="Data de emissão">
        <input name="issuedOn" type="date" />
      </Field>
      <Field label="Validade">
        <input name="expiresOn" type="date" />
      </Field>
      <Field label="Bloqueia operação se inválido?">
        <select name="isBlocking" defaultValue="false">
          <option value="false">Não</option>
          <option value="true">Sim</option>
        </select>
      </Field>
      <Field label="Observações" wide>
        <textarea name="notes" rows={5} />
      </Field>
    </DocumentFormShell>
  );
}

export function DocumentVersionForm({ documentId }: Readonly<{ documentId: string }>) {
  const [state, action, pending] = useActionState(createDocumentVersion, initialState);
  return (
    <DocumentFormShell
      title="Nova versão"
      description="Registre uma versão imutável de um arquivo já armazenado pelo provider autorizado."
      backHref={`/documentos/${documentId}?view=versions`}
      state={state}
      pending={pending}
      submitLabel="Registrar versão"
      action={action}
      governance={[
        'Versão numerada atomicamente no backend',
        'SHA-256 obrigatório',
        'Storage key não expõe segredo ou URL assinada',
        'Runtime sem UPDATE/DELETE em versões',
      ]}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <Field label="Provider *">
        <select name="storageProvider" defaultValue="external" required>
          <option value="external">Externo</option>
          <option value="s3">S3</option>
          <option value="gcs">Google Cloud Storage</option>
          <option value="azure">Azure Blob</option>
          <option value="local">Local controlado</option>
          <option value="other">Outro</option>
        </select>
      </Field>
      <Field label="Origem *">
        <select name="source" defaultValue="upload" required>
          <option value="upload">Upload</option>
          <option value="integration">Integração</option>
          <option value="migration">Migração</option>
          <option value="generated">Gerado</option>
        </select>
      </Field>
      <Field label="Chave do objeto *" wide>
        <input name="storageKey" required placeholder="bucket/pasta/objeto ou referência externa" />
      </Field>
      <Field label="Nome do arquivo *">
        <input name="fileName" required placeholder="documento.pdf" />
      </Field>
      <Field label="MIME type *">
        <input name="mimeType" required placeholder="application/pdf" />
      </Field>
      <Field label="Tamanho em bytes *">
        <input name="sizeBytes" type="number" min="1" step="1" required />
      </Field>
      <Field label="SHA-256 *" wide>
        <input name="sha256" required minLength={64} maxLength={64} />
      </Field>
      <Field label="Metadados JSON" wide>
        <textarea name="metadata" rows={7} defaultValue="{}" />
      </Field>
    </DocumentFormShell>
  );
}

export function DocumentValidationForm({
  documentId,
  versions,
}: Readonly<{ documentId: string; versions: readonly VersionOption[] }>) {
  const [state, action, pending] = useActionState(createDocumentValidation, initialState);
  return (
    <DocumentFormShell
      title="Nova validação"
      description="Acrescente uma decisão ao histórico imutável e atualize o estado agregado do documento."
      backHref={`/documentos/${documentId}?view=validations`}
      state={state}
      pending={pending}
      submitLabel="Registrar validação"
      action={action}
      governance={[
        'Histórico append-only',
        'Versão opcional validada por FK composta',
        'Rejeição pode bloquear documento operacional',
        'Validador é o usuário autenticado',
      ]}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <Field label="Versão">
        <select name="versionId" defaultValue="">
          <option value="">Documento como um todo</option>
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tipo de validação *">
        <select name="validationType" defaultValue="manual" required>
          <option value="manual">Manual</option>
          <option value="automated">Automatizada</option>
          <option value="antifraud">Antifraude</option>
          <option value="compliance">Compliance</option>
          <option value="other">Outra</option>
        </select>
      </Field>
      <Field label="Resultado *">
        <select name="status" defaultValue="validated" required>
          <option value="pending">Pendente</option>
          <option value="validated">Validado</option>
          <option value="rejected">Reprovado</option>
          <option value="warning">Alerta</option>
          <option value="not_applicable">Não aplicável</option>
        </select>
      </Field>
      <Field label="Provider / motor">
        <input name="provider" />
      </Field>
      <Field label="Regra / código">
        <input name="ruleCode" />
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
  targets: readonly DocumentLinkTargetOption[];
}>) {
  const [state, action, pending] = useActionState(createDocumentLink, initialState);
  const manualKinds = compatibleTargetKinds(subjectScope);
  const linkAvailable = targets.length > 0 || manualKinds.length > 0;
  return (
    <DocumentFormShell
      title="Novo vínculo"
      description={`Associe o documento a uma entidade compatível com o escopo ${subjectScope}.`}
      backHref={`/documentos/${documentId}?view=links`}
      state={state}
      pending={pending}
      submitLabel="Criar vínculo"
      submitDisabled={!linkAvailable}
      action={action}
      governance={[
        'Target kind sob whitelist',
        'FK composta por tenant',
        'Escopo do tipo documental validado no backend',
        'Desvinculação preserva histórico',
      ]}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <Field label="Entidade disponível" wide>
        <select name="targetChoice" defaultValue="">
          <option value="">Selecionar manualmente / coleção ainda não disponível</option>
          {targets.map((target) => (
            <option key={`${target.kind}:${target.id}`} value={`${target.kind}:${target.id}`}>
              {targetLabels[target.kind] ?? target.kind} • {target.label}
            </option>
          ))}
        </select>
      </Field>
      {manualKinds.length > 0 ? (
        <>
          <Field label="Tipo de entidade (fallback)">
            <select name="targetKind" defaultValue={manualKinds[0]}>
              {manualKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {targetLabels[kind] ?? kind}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ID da entidade (fallback)" wide>
            <input name="targetId" placeholder="UUID para entidade sem coleção global exposta" />
          </Field>
        </>
      ) : (
        <section className="form-summary-card field-wide">
          <strong>Vínculo aguardando o aggregate root deste módulo</strong>
          <p>
            O tipo documental está pronto, mas a entidade raiz correspondente ainda não existe na
            arquitetura atual. O backend não aceita vínculo genérico sem FK.
          </p>
        </section>
      )}
      <Field label="Relação *">
        <input name="relationType" defaultValue="attachment" required />
      </Field>
    </DocumentFormShell>
  );
}

export function DocumentUnlinkForm({
  documentId,
  linkId,
}: Readonly<{ documentId: string; linkId: string }>) {
  const [state, action, pending] = useActionState(unlinkDocumentLink, initialState);
  return (
    <DocumentFormShell
      title="Desvincular documento"
      description="Encerre o vínculo sem excluir o histórico da associação."
      backHref={`/documentos/${documentId}?view=links`}
      state={state}
      pending={pending}
      submitLabel="Confirmar desvinculação"
      action={action}
      governance={[
        'Nenhum DELETE físico',
        'Data e usuário de desvinculação persistidos',
        'Motivo obrigatório',
      ]}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="linkId" value={linkId} />
      <Field label="Motivo *" wide>
        <textarea name="reason" rows={6} required />
      </Field>
    </DocumentFormShell>
  );
}

function compatibleTargetKinds(subjectScope: string): readonly string[] {
  const map: Readonly<Record<string, readonly string[]>> = {
    party: ['party'],
    driver: ['driver', 'driver_document'],
    asset: ['asset', 'asset_document'],
    request: ['request'],
    contract: ['contract'],
    other: ['party', 'driver', 'driver_document', 'asset', 'asset_document', 'request', 'contract'],
    trip: [],
    financial: [],
  };
  return map[subjectScope] ?? [];
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
  state,
  pending,
  submitLabel,
  submitDisabled = false,
  action,
  governance,
  children,
}: Readonly<{
  title: string;
  description: string;
  backHref: string;
  state: DocumentSaveState;
  pending: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
  action: (formData: FormData) => void;
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
                <span className="eyebrow">Contrato protegido</span>
                <h2>Dados documentais</h2>
                <p>Somente campos previstos pelo contrato REST são enviados à API.</p>
              </div>
            </div>
            <div className="field-grid">{children}</div>
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
            <h2>Wave 0018 tenant-aware</h2>
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
