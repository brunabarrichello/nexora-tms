import { OperationalPage } from '../../_components/operational-page';
import { apiGet } from '../../_lib/api-client';
import {
  documentDate,
  documentStatusLabel,
  documentTabs,
  documentText,
  effectiveStatus,
  singleValues,
  type DocumentRecord,
  type DocumentSearchParams,
} from '../../_lib/document-ui';

export const metadata = { title: 'Validações documentais' };

export default async function Page({
  searchParams,
}: Readonly<{ searchParams: DocumentSearchParams }>) {
  const values = singleValues(await searchParams);
  const result = await apiGet<readonly DocumentRecord[]>('/api/v1/documents');
  const items = result.kind === 'ready' ? result.data : [];
  const queue = items.filter((item) => {
    if (item.requires_validation !== true) return false;
    const status = effectiveStatus(item);
    if (!['pending', 'rejected', 'draft'].includes(status)) return false;
    if (values.status && status !== values.status) return false;
    if (values.scope && String(item.subject_scope ?? '') !== values.scope) return false;
    const q = values.q?.toLowerCase();
    return (
      !q ||
      [item.title, item.document_type_name, item.external_reference]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  });

  return (
    <OperationalPage
      eyebrow="Documents • Wave 0018"
      title="Fila de validação"
      description="Documentos cujo tipo exige validação e ainda demandam decisão ou correção."
      status={result.kind === 'ready' ? 'API conectada' : 'API indisponível'}
      filters={[
        {
          label: 'Status',
          name: 'status',
          options: [
            { label: 'Rascunho', value: 'draft' },
            { label: 'Pendente', value: 'pending' },
            { label: 'Reprovado', value: 'rejected' },
          ],
        },
        {
          label: 'Escopo',
          name: 'scope',
          options: ['party', 'driver', 'asset', 'request', 'trip', 'financial', 'other'],
        },
      ]}
      columns={[
        { key: 'document', label: 'Documento', hrefKey: 'href' },
        { key: 'type', label: 'Tipo' },
        { key: 'scope', label: 'Escopo' },
        { key: 'expiry', label: 'Validade' },
        { key: 'status', label: 'Status' },
      ]}
      rows={queue.map((item) => ({
        id: documentText(item.id),
        document: documentText(item.title),
        href: `/documentos/${documentText(item.id)}/validacoes/nova`,
        type: documentText(item.document_type_name),
        scope: documentText(item.subject_scope),
        expiry: documentDate(item.expires_on),
        status: documentStatusLabel(effectiveStatus(item)),
      }))}
      tabs={documentTabs()}
      filterAction="/documentos/validacoes"
      filterValues={values}
      totalRows={queue.length}
      emptyTitle={result.kind === 'ready' ? 'Fila de validação vazia' : 'Validações indisponíveis'}
      emptyDescription={
        result.kind === 'ready'
          ? 'Nenhum documento exige ação com os filtros atuais.'
          : result.message
      }
      integrationNotes={[
        'A decisão detalhada é registrada no histórico append-only de document_validations.',
        'O status do documento é recalculado pelo backend após cada validação.',
      ]}
    />
  );
}
