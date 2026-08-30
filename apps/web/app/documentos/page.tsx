import { OperationalPage } from '../_components/operational-page';
import { apiGet, type ApiResult } from '../_lib/api-client';
import {
  documentDate,
  documentStatusLabel,
  documentTabs,
  documentText,
  singleValues,
  type DocumentPageData,
  type DocumentSearchParams,
  type ReferenceDocumentTypePage,
} from '../_lib/document-ui';

export const metadata = { title: 'Documentos' };

export default async function Page({
  searchParams,
}: Readonly<{ searchParams: DocumentSearchParams }>) {
  const values = singleValues(await searchParams);
  const [documents, types] = await Promise.all([
    apiGet<DocumentPageData>('/api/v1/documents', {
      q: values.q,
      status: values.status,
      validationStatus: values.validationStatus,
      documentTypeId: values.documentTypeId,
      limit: '100',
    }),
    apiGet<ReferenceDocumentTypePage>('/api/v1/reference-data/document-types', {
      active: 'true',
      limit: '100',
    }),
  ]);
  const state = apiState(documents);
  const data = documents.kind === 'ready' ? documents.data : null;
  const rows =
    data?.items.map((item) => ({
      id: documentText(item.id),
      title: documentText(item.title),
      titleHref: `/documentos/${documentText(item.id)}`,
      type: documentText(item.document_type_name),
      number: documentText(item.document_number),
      expiry: documentDate(item.expires_on),
      validation: documentStatusLabel(item.validation_status),
      status: documentStatusLabel(item.effective_status ?? item.status),
    })) ?? [];
  const typeOptions =
    types.kind === 'ready'
      ? types.data.items.map((type) => ({ label: type.name, value: type.id }))
      : [];

  return (
    <OperationalPage
      eyebrow="Documents • Wave 0018"
      title="Documentos"
      description="Documento lógico versionado, validável e vinculável a entidades reais do TMS, sem duplicar os registros de compliance de motorista e ativo."
      status={state.status}
      metrics={[
        {
          label: 'Documentos',
          value: data ? String(data.total) : undefined,
          helper: 'Total retornado pela API para o filtro atual.',
        },
        {
          label: 'Carregados',
          value: data ? String(data.items.length) : undefined,
          helper: 'Registros presentes neste recorte server-side.',
        },
      ]}
      filters={[
        {
          label: 'Status',
          name: 'status',
          options: [
            { label: 'Rascunho', value: 'draft' },
            { label: 'Ativo', value: 'active' },
            { label: 'Vencido', value: 'expired' },
            { label: 'Bloqueado', value: 'blocked' },
            { label: 'Arquivado', value: 'archived' },
          ],
        },
        {
          label: 'Validação',
          name: 'validationStatus',
          options: [
            { label: 'Pendente', value: 'pending' },
            { label: 'Validado', value: 'validated' },
            { label: 'Reprovado', value: 'rejected' },
            { label: 'Não exigida', value: 'not_required' },
          ],
        },
        { label: 'Tipo documental', name: 'documentTypeId', options: typeOptions },
      ]}
      filterAction="/documentos"
      filterValues={values}
      columns={[
        { key: 'title', label: 'Documento', hrefKey: 'titleHref' },
        { key: 'type', label: 'Tipo' },
        { key: 'number', label: 'Número' },
        { key: 'expiry', label: 'Validade' },
        { key: 'validation', label: 'Validação' },
        { key: 'status', label: 'Status' },
      ]}
      rows={rows}
      totalRows={data?.total}
      actions={[{ href: '/documentos/novo', label: 'Novo documento' }]}
      tabs={documentTabs()}
      emptyTitle={state.emptyTitle}
      emptyDescription={state.message}
      integrationNotes={[
        'GET/POST /api/v1/documents protegido pelo TenantRuntimeGateGuard.',
        'Status efetivo considera vencimento sem falsificar atualização física do registro.',
        'Versões, validações e vínculos são acessados no detalhe do documento.',
      ]}
    />
  );
}

function apiState(result: ApiResult<unknown>) {
  switch (result.kind) {
    case 'ready':
      return {
        status: 'API conectada',
        emptyTitle: 'Nenhum documento encontrado',
        message: 'A consulta foi executada com sucesso e não retornou registros.',
      };
    case 'unconfigured':
      return {
        status: 'API não configurada',
        emptyTitle: 'Integração aguardando ambiente',
        message: result.message,
      };
    case 'unauthorized':
      return {
        status: 'Autorização pendente',
        emptyTitle: 'Sessão sem acesso à API',
        message: result.message,
      };
    case 'error':
      return {
        status: 'API indisponível',
        emptyTitle: 'Falha ao consultar documentos',
        message: result.message,
      };
  }
}
