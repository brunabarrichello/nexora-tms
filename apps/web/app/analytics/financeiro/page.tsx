import { apiGet } from '../../_lib/api-client';

interface FinancialIndicatorCustomerOption {
  readonly id: string;
  readonly name: string;
}

interface FinancialIndicatorCurrency {
  readonly currencyCode: string;
  readonly plannedRevenueAmount: string;
  readonly invoicedRevenueAmount: string;
  readonly contractedCostAmount: string;
  readonly marginAmount: string;
  readonly marginPercentage: string | null;
  readonly operationCount: number;
  readonly contractedOperationCount: number;
  readonly marginEligibleOperationCount: number;
  readonly invoicedReceivableCount: number;
}

interface FinancialIndicatorsSnapshot {
  readonly period: { readonly from: string; readonly to: string };
  readonly customerPartyId: string | null;
  readonly customers: readonly FinancialIndicatorCustomerOption[];
  readonly byCurrency: readonly FinancialIndicatorCurrency[];
  readonly reconciliation: {
    readonly plannedRevenue: string;
    readonly invoicedRevenue: string;
    readonly contractedCost: string;
    readonly margin: string;
  };
  readonly generatedAt: string;
}

type SearchParams = Promise<{ from?: string; to?: string; customerPartyId?: string }>;

export const metadata = { title: 'Indicadores financeiros' };

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.from) query.set('from', normalizeBoundary(params.from, false));
  if (params.to) query.set('to', normalizeBoundary(params.to, true));
  if (params.customerPartyId) query.set('customerPartyId', params.customerPartyId);
  const suffix = query.size ? `?${query.toString()}` : '';
  const result = await apiGet<FinancialIndicatorsSnapshot>(`/api/v1/analytics/financial${suffix}`);
  const data = result.kind === 'ready' ? result.data : null;
  const message = result.kind === 'ready' ? null : result.message;

  return (
    <div className="page-stack">
      <section className="page-hero dashboard-hero">
        <div>
          <span className="eyebrow">Analytics • NEX-59</span>
          <h1>Indicadores financeiros essenciais</h1>
          <p>
            Receita prevista e faturada, custo contratado e margem reconciliados com os agregados
            financeiros canônicos do tenant.
          </p>
        </div>
        <span className="status-badge">{data ? 'API conectada' : 'API indisponível'}</span>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Filtros</span>
            <h2>Período e cliente</h2>
          </div>
        </div>
        <form className="filter-bar" method="get">
          <label>
            De
            <input name="from" type="date" defaultValue={params.from ?? ''} />
          </label>
          <label>
            Até
            <input name="to" type="date" defaultValue={params.to ?? ''} />
          </label>
          <label>
            Cliente
            <select name="customerPartyId" defaultValue={params.customerPartyId ?? ''}>
              <option value="">Todos</option>
              {data?.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-primary" type="submit">
            Aplicar
          </button>
          <a className="button" href="/analytics/financeiro">
            Últimos 30 dias
          </a>
        </form>
      </section>

      {data ? (
        data.byCurrency.length ? (
          data.byCurrency.map((indicator) => (
            <section className="panel" key={indicator.currencyCode}>
              <div className="panel-header">
                <div>
                  <span className="eyebrow">{indicator.currencyCode}</span>
                  <h2>Resumo financeiro</h2>
                </div>
                <span className="status-badge">
                  {indicator.contractedOperationCount} operações contratadas
                </span>
              </div>
              <div className="metric-grid" aria-label={`Indicadores ${indicator.currencyCode}`}>
                <Metric
                  label="Receita prevista"
                  value={formatAmount(indicator.plannedRevenueAmount, indicator.currencyCode)}
                  detail={`${indicator.operationCount} operações no período`}
                />
                <Metric
                  label="Receita faturada"
                  value={formatAmount(indicator.invoicedRevenueAmount, indicator.currencyCode)}
                  detail={`${indicator.invoicedReceivableCount} contas a receber`}
                />
                <Metric
                  label="Custo contratado"
                  value={formatAmount(indicator.contractedCostAmount, indicator.currencyCode)}
                  detail="Frete + pedágio + adicionais"
                />
                <Metric
                  label="Margem"
                  value={formatAmount(indicator.marginAmount, indicator.currencyCode)}
                  detail={
                    indicator.marginPercentage === null
                      ? 'Sem base contratada compatível'
                      : `${indicator.marginPercentage}% sobre receita elegível`
                  }
                />
              </div>
            </section>
          ))
        ) : (
          <section className="panel">
            <h2>Sem movimentos financeiros</h2>
            <p>Nenhum indicador foi encontrado para os filtros selecionados.</p>
          </section>
        )
      ) : (
        <section className="panel">
          <h2>Indicadores indisponíveis</h2>
          <p>{message}</p>
        </section>
      )}

      {data ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Reconciliação</span>
              <h2>Fontes canônicas</h2>
            </div>
          </div>
          <div className="roadmap-list">
            <Source label="Receita prevista" detail={data.reconciliation.plannedRevenue} />
            <Source label="Receita faturada" detail={data.reconciliation.invoicedRevenue} />
            <Source label="Custo contratado" detail={data.reconciliation.contractedCost} />
            <Source label="Margem" detail={data.reconciliation.margin} />
          </div>
          <p>
            Janela: {formatDate(data.period.from)} até {formatDate(data.period.to)}. Tenant derivado
            exclusivamente do contexto autenticado e protegido por RLS.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Source({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="roadmap-item">
      <div className="roadmap-copy">
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function normalizeBoundary(value: string, endOfDay: boolean): string {
  return endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`;
}

function formatAmount(value: string, currencyCode: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currencyCode,
  }).format(Number(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
