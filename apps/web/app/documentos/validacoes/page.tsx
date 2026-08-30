import { OperationalPage } from '../../_components/operational-page';
import { apiGet } from '../../_lib/api-client';
import {
  documentStatusLabel,
  documentTabs,
  documentText,
  singleValues,
  type DocumentPageData,
  type DocumentSearchParams,
} from '../../_lib/document-ui';

export const metadata = { title: 'Validações documentais' };

export default async function Page({
  searchParams,
}: Readonly<{ searchParams: DocumentSearchParams }>) {
  const values = singleValues(await searchParams);
  const validationStatus = values.validationStatus || 'pending';
  const result = await apiGet<DocumentPageData>('/api/v1/documents', {
    q: values.q,
    validationStatus,
    limit: '100',
  });
  const data = result.kind === 'ready' ? result.data : null;
  const rows =
    data?.items.map((item) => ({
      id: documentText(item.id),
      document: documentText(item.title),
      documentHref: `/documentos/${documentText(item.id)}?view=validations`,
      type: documentText(item.document_type_name),
      validation: documentStatusLabel(item.validation_status),
      status: documentStatusLabel(item.effective_status ?? item.status),
    })) ?? [];
  return (
    <OperationalPage
      eyebrow="Documents • Wave 0018"
      title="Validações documentais"
      description="Fila real de documentos por estado agregado de validação; cada decisão permanece no histórico append-only do documento."
      status={result.kind === 'ready' ? 'API conectada' : 'Integração indisponível'}
      filters={[
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
      ]}
      filterAction="/documentos/validacoes"
      filterValues={{ ...values, validationStatus }}
      columns={[
        { key: 'document', label: 'Documento', hrefKey: 'documentHref' },
        { key: 'type', label: 'Tipo' },
        { key: 'validation', label: 'Validação' },
        { key: 'status', label: 'Status' },
      ]}
      rows={rows}
      totalRows={data?.total}
      tabs={documentTabs()}
      emptyTitle="Nenhum documento nesta fila"
      emptyDescription={
        result.kind === 'ready'
          ? 'A API não retornou documentos com o estado selecionado.'
          : result.message
      }
      integrationNotes={[
        'A fila não inventa validações: ela deriva do estado agregado persistido em documents.',
        'Abra o documento para consultar todo o histórico e registrar uma nova decisão.',
      ]}
    />
  );
}
