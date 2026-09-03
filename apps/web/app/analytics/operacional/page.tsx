import { apiGet } from '../../_lib/api-client';

interface OperationalDashboardSnapshot {
  readonly period: { readonly from: string; readonly to: string };
  readonly transportRequests: {
    readonly total: number;
    readonly byStatus: Readonly<Record<string, number>>;
    readonly withoutContract: number;
  };
  readonly trips: {
    readonly total: number;
    readonly byStatus: Readonly<Record<string, number>>;
    readonly inProgress: number;
    readonly overdue: number;
  };
  readonly occurrences: {
    readonly open: number;
    readonly criticalOpen: number;
  };
  readonly documents: { readonly blockingFindings: number };
  readonly generatedAt: string;
}

type SearchParams = Promise<{ from?: string; to?: string }>;

export const metadata = { title: 'Dashboard operacional' };

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.from) query.set('from', normalizeBoundary(params.from, false));
  if (params.to) query.set('to', normalizeBoundary(params.to, true));
  const suffix = query.size ? `?${query.toString()}` : '';
  const result = await apiGet<OperationalDashboardSnapshot>(
    `/api/v1/analytics/operational${suffix}`,
  );
  const data = result.kind === 'ready' ? result.data : null;
  const message = result.kind === 'ready' ? null : result.message;

  return (
    <div className="page-stack">
      <section className="page-hero dashboard-hero">
        <div>
          <span className="eyebrow">Analytics • NEX-58</span>
          <h1>Dashboard operacional</h1>
          <p>
            Cargas, viagens, ocorrências e bloqueios documentais em uma projeção read-only sobre os
            dados canônicos do tenant.
          </p>
        </div>
        <span className="status-badge">{data ? 'API conectada' : 'API indisponível'}</span>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Período</span>
            <h2>Filtrar dashboard</h2>
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
          <button className="button button-primary" type="submit">
            Aplicar
          </button>
          <a className="button" href="/analytics/operacional">
            Últimos 30 dias
          </a>
        </form>
      </section>

      {data ? (
        <>
          <section className="metric-grid" aria-label="Indicadores operacionais">
            <Metric
              label="Cargas no período"
              value={data.transportRequests.total}
              detail={`${data.transportRequests.withoutContract} sem contratação`}
            />
            <Metric
              label="Viagens em trânsito"
              value={data.trips.inProgress}
              detail={`${data.trips.overdue} atrasadas`}
            />
            <Metric
              label="Ocorrências abertas"
              value={data.occurrences.open}
              detail={`${data.occurrences.criticalOpen} críticas`}
            />
            <Metric
              label="Bloqueios documentais"
              value={data.documents.blockingFindings}
              detail="Achados atuais de compliance"
            />
          </section>

          <div className="dashboard-grid">
            <StatusPanel title="Cargas por status" values={data.transportRequests.byStatus} />
            <StatusPanel title="Viagens por status" values={data.trips.byStatus} />
          </div>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Janela consultada</span>
                <h2>Rastreabilidade</h2>
              </div>
            </div>
            <p>
              {formatDate(data.period.from)} até {formatDate(data.period.to)}. O tenant é derivado
              exclusivamente do contexto autenticado; não existe parâmetro para consultar outro
              tenant.
            </p>
          </section>
        </>
      ) : (
        <section className="panel">
          <h2>Dashboard indisponível</h2>
          <p>{message}</p>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function StatusPanel({
  title,
  values,
}: {
  title: string;
  values: Readonly<Record<string, number>>;
}) {
  const entries = Object.entries(values);
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>
      <div className="roadmap-list">
        {entries.length ? (
          entries.map(([status, count]) => (
            <div className="roadmap-item" key={status}>
              <div className="roadmap-copy">
                <strong>{statusLabel(status)}</strong>
              </div>
              <span className="status-badge">{count}</span>
            </div>
          ))
        ) : (
          <p>Nenhum registro no período.</p>
        )}
      </div>
    </section>
  );
}

function statusLabel(value: string): string {
  return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function normalizeBoundary(value: string, endOfDay: boolean): string {
  return endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
