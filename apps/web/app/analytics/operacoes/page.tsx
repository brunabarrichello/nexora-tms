import { apiGet } from '../../_lib/api-client';

interface OperationalReportRow {
  readonly transportRequestId: string;
  readonly cargoDescription: string;
  readonly requestStatus: string;
  readonly customer: string;
  readonly origin: string;
  readonly destination: string;
  readonly plannedPickupAt: string;
  readonly plannedDeliveryAt: string;
  readonly contractStatus: string | null;
  readonly tripCode: string | null;
  readonly tripStatus: string | null;
}

interface OperationalReportResult {
  readonly period: { readonly from: string; readonly to: string };
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly rows: readonly OperationalReportRow[];
  readonly generatedAt: string;
}

type SearchParams = Promise<{
  from?: string;
  to?: string;
  customerPartyId?: string;
  origin?: string;
  destination?: string;
  status?: string;
  page?: string;
}>;

export const metadata = { title: 'Relatório operacional' };

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.from) query.set('from', normalizeBoundary(params.from, false));
  if (params.to) query.set('to', normalizeBoundary(params.to, true));
  for (const key of ['customerPartyId', 'origin', 'destination', 'status', 'page'] as const) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  const suffix = query.size ? `?${query.toString()}` : '';
  const result = await apiGet<OperationalReportResult>(
    `/api/v1/analytics/operational-report${suffix}`,
  );
  const data = result.kind === 'ready' ? result.data : null;
  const message = result.kind === 'ready' ? null : result.message;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="page-stack">
      <section className="page-hero dashboard-hero">
        <div>
          <span className="eyebrow">Analytics • NEX-60</span>
          <h1>Relatório operacional</h1>
          <p>Consulta paginada de cargas, contratação e viagem para conferência operacional.</p>
        </div>
        <span className="status-badge">
          {data ? `${data.total} operações` : 'API indisponível'}
        </span>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Filtros</span>
            <h2>Período e operação</h2>
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
            Cliente (ID)
            <input name="customerPartyId" defaultValue={params.customerPartyId ?? ''} />
          </label>
          <label>
            Origem
            <input name="origin" defaultValue={params.origin ?? ''} />
          </label>
          <label>
            Destino
            <input name="destination" defaultValue={params.destination ?? ''} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={params.status ?? ''}>
              <option value="">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="ready_for_quote">Pronta para cotação</option>
              <option value="in_negotiation">Em negociação</option>
              <option value="contracted">Contratada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
          <button className="button button-primary" type="submit">
            Aplicar
          </button>
          <a className="button" href="/analytics/operacoes">
            Últimos 30 dias
          </a>
        </form>
      </section>

      {data ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Resultado</span>
              <h2>
                Página {data.page} de {totalPages}
              </h2>
            </div>
            <span className="status-badge">{data.rows.length} nesta página</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Carga</th>
                  <th>Cliente</th>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th>Contratação</th>
                  <th>Viagem</th>
                  <th>Janela</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.transportRequestId}>
                    <td>
                      <strong>{row.cargoDescription}</strong>
                      <br />
                      <small>{row.requestStatus}</small>
                    </td>
                    <td>{row.customer}</td>
                    <td>{row.origin}</td>
                    <td>{row.destination}</td>
                    <td>{row.contractStatus ?? '—'}</td>
                    <td>{row.tripCode ? `${row.tripCode} · ${row.tripStatus}` : '—'}</td>
                    <td>
                      {formatDate(row.plannedPickupAt)}
                      <br />
                      até {formatDate(row.plannedDeliveryAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.rows.length ? (
            <p>Nenhuma operação encontrada para os filtros selecionados.</p>
          ) : null}
          <div className="filter-bar">
            {data.page > 1 ? (
              <a className="button" href={buildPageHref(params, data.page - 1)}>
                Anterior
              </a>
            ) : null}
            {data.page < totalPages ? (
              <a className="button button-primary" href={buildPageHref(params, data.page + 1)}>
                Próxima
              </a>
            ) : null}
          </div>
          <p>
            Janela: {formatDate(data.period.from)} até {formatDate(data.period.to)}. Tenant derivado
            do contexto autenticado e protegido por RLS.
          </p>
        </section>
      ) : (
        <section className="panel">
          <h2>Relatório indisponível</h2>
          <p>{message}</p>
        </section>
      )}
    </div>
  );
}

function normalizeBoundary(value: string, endOfDay: boolean): string {
  return endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function buildPageHref(params: Awaited<SearchParams>, page: number): string {
  const query = new URLSearchParams();
  for (const key of ['from', 'to', 'customerPartyId', 'origin', 'destination', 'status'] as const) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  query.set('page', String(page));
  return `/analytics/operacoes?${query.toString()}`;
}
