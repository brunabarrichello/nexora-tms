import { OperationalPage } from '../../_components/operational-page';
import { apiGet } from '../../_lib/api-client';
import {
  documentDate,
  documentStatusLabel,
  documentTabs,
  documentText,
  singleValues,
  type DocumentPageData,
  type DocumentSearchParams,
} from '../../_lib/document-ui';

export const metadata = { title: 'Vencimentos documentais' };

export default async function Page({
  searchParams,
}: Readonly<{ searchParams: DocumentSearchParams }>) {
  const values = singleValues(await searchParams);
  const days = normalizeDays(values.days);
  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + days);
  const expiringBefore = horizon.toISOString().slice(0, 10);
  const result = await apiGet<DocumentPageData>('/api/v1/documents', {
    q: values.q,
    expiringBefore,
    limit: '100',
  });
  const data = result.kind === 'ready' ? result.data : null;
  const rows =
    data?.items.map((item) => ({
      id: documentText(item.id),
      document: documentText(item.title),
      documentHref: `/documentos/${documentText(item.id)}`,
      type: documentText(item.document_type_name),
      expiry: documentDate(item.expires_on),
      remaining: remainingDays(item.expires_on),
      status: documentStatusLabel(item.effective_status ?? item.status),
    })) ?? [];
  return (
    <OperationalPage
      eyebrow="Documents • Wave 0018"
      title="Vencimentos documentais"
      description={`Documentos com validade até ${documentDate(expiringBefore)}, incluindo vencidos para tratamento operacional.`}
      status={result.kind === 'ready' ? 'API conectada' : 'Integração indisponível'}
      filters={[
        {
          label: 'Horizonte',
          name: 'days',
          options: [
            { label: '7 dias', value: '7' },
            { label: '30 dias', value: '30' },
            { label: '60 dias', value: '60' },
            { label: '90 dias', value: '90' },
            { label: '180 dias', value: '180' },
          ],
        },
      ]}
      filterAction="/documentos/vencimentos"
      filterValues={{ ...values, days: String(days) }}
      columns={[
        { key: 'document', label: 'Documento', hrefKey: 'documentHref' },
        { key: 'type', label: 'Tipo' },
        { key: 'expiry', label: 'Validade' },
        { key: 'remaining', label: 'Prazo' },
        { key: 'status', label: 'Status' },
      ]}
      rows={rows}
      totalRows={data?.total}
      tabs={documentTabs()}
      emptyTitle="Nenhum vencimento no horizonte"
      emptyDescription={
        result.kind === 'ready'
          ? 'Nenhum documento com validade dentro do período.'
          : result.message
      }
      integrationNotes={[
        'O status efetivo marca documentos vencidos mesmo antes de um job materializar o lifecycle.',
        'O horizonte é enviado como filtro server-side expiringBefore.',
      ]}
    />
  );
}

function normalizeDays(value?: string): number {
  const parsed = Number(value ?? '30');
  return [7, 30, 60, 90, 180].includes(parsed) ? parsed : 30;
}

function remainingDays(value: unknown): string {
  if (!value) return '—';
  const expiry = new Date(`${String(value).slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(expiry)) return '—';
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.ceil((expiry - start) / 86_400_000);
  if (days < 0) return `${Math.abs(days)} dia(s) vencido`;
  if (days === 0) return 'Vence hoje';
  return `${days} dia(s)`;
}
