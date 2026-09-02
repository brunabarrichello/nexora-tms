import { OperationalPage } from '../../_components/operational-page';
import { apiGet } from '../../_lib/api-client';

interface OperationMarginRecord {
  readonly transportRequestId: string;
  readonly transportRequestStatus: string;
  readonly cargoDescription: string;
  readonly customerName: string;
  readonly stage: 'planned' | 'contracted';
  readonly currencyCode: string;
  readonly costCurrencyCode: string;
  readonly currencyConsistent: boolean;
  readonly revenueAmount: string | null;
  readonly carrierFreightAmount: string;
  readonly tollAmount: string;
  readonly additionalAmount: string;
  readonly totalCostAmount: string;
  readonly marginAmount: string | null;
  readonly marginPercentage: string | null;
  readonly contractStatus: string | null;
}

export const metadata = { title: 'Margens operacionais' };

export default async function Page() {
  const result = await apiGet<readonly OperationMarginRecord[]>('/api/v1/finance/margins');
  const items = result.kind === 'ready' ? result.data : [];

  return (
    <OperationalPage
      eyebrow="Financeiro • NEX-50"
      title="Margens operacionais"
      description="Receita, custo e margem por carga, recalculados automaticamente quando a contratação é confirmada."
      status={result.kind === 'ready' ? 'API conectada' : 'API indisponível'}
      columns={[
        { key: 'customer', label: 'Cliente' },
        { key: 'cargo', label: 'Carga' },
        { key: 'stage', label: 'Base' },
        { key: 'revenue', label: 'Receita' },
        { key: 'cost', label: 'Custo total' },
        { key: 'margin', label: 'Margem' },
        { key: 'marginPercent', label: 'Margem %' },
      ]}
      rows={items.map((item) => ({
        id: item.transportRequestId,
        customer: item.customerName,
        cargo: item.cargoDescription,
        stage: item.stage === 'contracted' ? 'Contratado' : 'Planejado',
        revenue: money(item.revenueAmount, item.currencyCode),
        cost: money(item.totalCostAmount, item.costCurrencyCode),
        margin: item.currencyConsistent ? money(item.marginAmount, item.currencyCode) : 'Moedas distintas',
        marginPercent: percent(item.marginPercentage),
      }))}
      totalRows={items.length}
      emptyTitle={result.kind === 'ready' ? 'Nenhuma margem disponível' : 'Margens indisponíveis'}
      emptyDescription={
        result.kind === 'ready'
          ? 'Cadastre os termos comerciais de uma carga para iniciar a projeção de rentabilidade.'
          : result.message
      }
      integrationNotes={[
        'Antes da contratação, o custo usa frete-alvo, pedágio e adicionais dos termos comerciais.',
        'Após contratação confirmada ou cumprida, o custo passa a usar automaticamente os valores canônicos do contrato.',
        'Receita ausente ou igual a zero mantém margem percentual indisponível, evitando divisão inválida.',
      ]}
    />
  );
}

function money(value: string | null, currency: string): string {
  if (value === null) return 'Não informado';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount);
}

function percent(value: string | null): string {
  if (value === null) return '—';
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toFixed(2)}%` : value;
}
