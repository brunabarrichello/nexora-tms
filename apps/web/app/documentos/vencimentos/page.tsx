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

export const metadata = { title: 'Vencimentos documentais' };

export default async function Page({
  searchParams,
}: Readonly<{ searchParams: DocumentSearchParams }>) {
  const values = singleValues(await searchParams);
  const result = await apiGet<readonly DocumentRecord[]>('/api/v1/documents');
  const items = result.kind === 'ready' ? result.data : [];
  const windowDays = Number(values.window || '30');
  const now = Date.now();
  const upper = now + (Number.isFinite(windowDays) ? windowDays : 30) * 86_400_000;
  const expiring = items
    .filter((item) => {
      if (!item.expires_on) return false;
      const expiry = new Date(`${String(item.expires_on).slice(0, 10)}T00:00:00Z`).getTime();
      if (Number.isNaN(expiry)) return false;
      if (values.scope && String(item.subject_scope ?? '') !== values.scope) return false;
      return expiry <= upper;
    })
    .sort((a, b) => String(a.expires_on).localeCompare(String(b.expires_on)));

  return (
    <OperationalPage
      eyebrow="Documents • Wave 0018"
      title="Vencimentos"
      description="Agenda real de documentos vencidos ou com validade dentro da janela operacional selecionada."
      status={result.kind === 'ready' ? 'API conectada' : 'API indisponível'}
      filters={[
        {
          label: 'Janela',
          name: 'window',
          options: [
            { label: '7 dias', value: '7' },
            { label: '15 dias', value: '15' },
            { label: '30 dias', value: '30' },
            { label: '60 dias', value: '60' },
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
        { key: 'expires', label: 'Vence em' },
        { key: 'days', label: 'Dias' },
        { key: 'status', label: 'Status' },
      ]}
      rows={expiring.map((item) => {
        const expiry = new Date(`${String(item.expires_on).slice(0, 10)}T00:00:00Z`).getTime();
        const days = Math.ceil((expiry - now) / 86_400_000);
        return {
          id: documentText(item.id),
          document: documentText(item.title),
          href: `/documentos/${documentText(item.id)}`,
          type: documentText(item.document_type_name),
          scope: documentText(item.subject_scope),
          expires: documentDate(item.expires_on),
          days: days < 0 ? `${Math.abs(days)} dias vencido` : days === 0 ? 'Hoje' : `${days} dias`,
          status: documentStatusLabel(effectiveStatus(item)),
        };
      })}
      tabs={documentTabs()}
      filterAction="/documentos/vencimentos"
      filterValues={values}
      totalRows={expiring.length}
      emptyTitle={
        result.kind === 'ready' ? 'Nenhum vencimento na janela' : 'Vencimentos indisponíveis'
      }
      emptyDescription={
        result.kind === 'ready'
          ? 'Não há documentos vencidos ou próximos do vencimento com os filtros atuais.'
          : result.message
      }
      integrationNotes={[
        'A agenda usa expires_on real; documentos vencidos permanecem visíveis independentemente da janela futura.',
        'Alertas automáticos serão ligados posteriormente ao bounded context Notifications.',
      ]}
    />
  );
}
