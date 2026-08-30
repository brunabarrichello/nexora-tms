import { OperationalPage } from '../_components/operational-page';
import { apiGet } from '../_lib/api-client';
import {
  documentDate,
  documentStatusLabel,
  documentTabs,
  documentText,
  effectiveStatus,
  isExpiringWithin,
  singleValues,
  type DocumentRecord,
  type DocumentSearchParams,
} from '../_lib/document-ui';

export const metadata = { title: 'Documentos' };

export default async function Page({
  searchParams,
}: Readonly<{ searchParams: DocumentSearchParams }>) {
  const values = singleValues(await searchParams);
  const result = await apiGet<readonly DocumentRecord[]>('/api/v1/documents');
  const items = result.kind === 'ready' ? result.data : [];
  const filtered = items.filter((item) => {
    const q = values.q?.toLowerCase();
    if (
      q &&
      ![item.title, item.document_type_name, item.external_reference]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    )
      return false;
    if (values.status && effectiveStatus(item) !== values.status) return false;
    if (values.scope && String(item.subject_scope ?? '') !== values.scope) return false;
    return true;
  });

  return (
    <OperationalPage
      eyebrow="Documents • Wave 0018"
      title="Documentos"
      description="Core documental canônico com lifecycle, versões imutáveis, validações e vínculos tenant-aware."
      status={result.kind === 'ready' ? 'API conectada' : 'API indisponível'}
      actions={[{ href: '/documentos/novo', label: 'Novo documento' }]}
      metrics={[
        {
          label: 'Válidos',
          value: String(items.filter((item) => effectiveStatus(item) === 'valid').length),
          helper: 'Documentos efetivamente válidos.',
        },
        {
          label: 'A vencer',
          value: String(items.filter((item) => isExpiringWithin(item, 30)).length),
          helper: 'Próximos 30 dias.',
        },
        {
          label: 'Pendentes',
          value: String(items.filter((item) => effectiveStatus(item) === 'pending').length),
          helper: 'Aguardando validação ou versão.',
        },
        {
          label: 'Reprovados',
          value: String(items.filter((item) => effectiveStatus(item) === 'rejected').length),
          helper: 'Exigem correção operacional.',
        },
      ]}
      filters={[
        {
          label: 'Status',
          name: 'status',
          options: [
            { label: 'Rascunho', value: 'draft' },
            { label: 'Pendente', value: 'pending' },
            { label: 'Válido', value: 'valid' },
            { label: 'Reprovado', value: 'rejected' },
            { label: 'Vencido', value: 'expired' },
          ],
        },
        {
          label: 'Escopo',
          name: 'scope',
          options: ['party', 'driver', 'asset', 'request', 'trip', 'financial', 'other'],
        },
      ]}
      columns={[
        { key: 'title', label: 'Documento', hrefKey: 'href' },
        { key: 'type', label: 'Tipo' },
        { key: 'scope', label: 'Escopo' },
        { key: 'reference', label: 'Referência' },
        { key: 'expiry', label: 'Validade' },
        { key: 'status', label: 'Status' },
      ]}
      rows={filtered.map((item) => ({
        id: documentText(item.id),
        title: documentText(item.title),
        href: `/documentos/${documentText(item.id)}`,
        type: documentText(item.document_type_name),
        scope: documentText(item.subject_scope),
        reference: documentText(item.external_reference),
        expiry: documentDate(item.expires_on),
        status: documentStatusLabel(effectiveStatus(item)),
      }))}
      tabs={documentTabs()}
      filterAction="/documentos"
      filterValues={values}
      totalRows={filtered.length}
      emptyTitle={
        result.kind === 'ready' ? 'Nenhum documento encontrado' : 'Documentos indisponíveis'
      }
      emptyDescription={
        result.kind === 'ready' ? 'Crie o primeiro documento ou ajuste os filtros.' : result.message
      }
      integrationNotes={[
        'Status vencido é calculado pelo backend a partir da validade.',
        'O storage possui boundary próprio; nenhum segredo é exibido pela Web.',
        'Documentos arquivados deixam a listagem ativa por soft delete.',
      ]}
    />
  );
}
