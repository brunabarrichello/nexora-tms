import { OperationalPage } from '../_components/operational-page';
import { apiGet } from '../_lib/api-client';
import {
  documentDate,
  documentStatusLabel,
  documentTabs,
  documentText,
  policyAwareStatus,
  singleValues,
  type DocumentCompliancePolicyRecord,
  type DocumentRecord,
  type DocumentSearchParams,
} from '../_lib/document-ui';

export const metadata = { title: 'Documentos' };

export default async function Page({
  searchParams,
}: Readonly<{ searchParams: DocumentSearchParams }>) {
  const values = singleValues(await searchParams);
  const [result, policyResult] = await Promise.all([
    apiGet<readonly DocumentRecord[]>('/api/v1/documents'),
    apiGet<readonly DocumentCompliancePolicyRecord[]>('/api/v1/document-compliance/policies'),
  ]);
  const items = result.kind === 'ready' ? result.data : [];
  const policies = policyResult.kind === 'ready' ? policyResult.data : [];
  const filtered = items.filter((item) => {
    const q = values.q?.toLowerCase();
    if (
      q &&
      ![item.title, item.document_type_name, item.external_reference]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    )
      return false;
    if (values.status && policyAwareStatus(item, policies) !== values.status) return false;
    if (values.scope && String(item.subject_scope ?? '') !== values.scope) return false;
    return true;
  });

  return (
    <OperationalPage
      eyebrow="Documents • NEX-47"
      title="Documentos"
      description="Core documental canônico com validade, políticas de bloqueio e alertas tenant-aware por tipo documental."
      status={result.kind === 'ready' ? 'API conectada' : 'API indisponível'}
      actions={[{ href: '/documentos/novo', label: 'Novo documento' }]}
      metrics={[
        {
          label: 'Válidos',
          value: String(items.filter((item) => policyAwareStatus(item, policies) === 'valid').length),
          helper: 'Fora da janela de alerta configurada.',
        },
        {
          label: 'A vencer',
          value: String(
            items.filter((item) => policyAwareStatus(item, policies) === 'expiring_soon').length,
          ),
          helper: 'Janela definida pela política do tipo documental.',
        },
        {
          label: 'Pendentes',
          value: String(items.filter((item) => policyAwareStatus(item, policies) === 'pending').length),
          helper: 'Aguardando validação ou versão.',
        },
        {
          label: 'Bloqueantes',
          value: String(
            items.filter((item) => ['rejected', 'expired'].includes(policyAwareStatus(item, policies))).length,
          ),
          helper: 'Reprovados ou vencidos; enforcement depende da política.',
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
            { label: 'A vencer', value: 'expiring_soon' },
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
        status: documentStatusLabel(policyAwareStatus(item, policies)),
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
        'A janela “A vencer” usa warningDays da política tenant-scoped do tipo documental; 30 dias é apenas fallback para tipos ainda sem política.',
        'Contratação e viagem são bloqueadas no banco quando uma política ativa encontra documento ausente, pendente, reprovado ou vencido conforme configuração.',
        'Overrides administrativos são temporários, imutáveis e auditáveis; não alteram o documento original.',
      ]}
    />
  );
}
