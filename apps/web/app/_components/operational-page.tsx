import Link from 'next/link';

type Metric = {
  label: string;
  value?: string;
  helper: string;
};

type Filter = {
  label: string;
  name: string;
  options?: string[];
  placeholder?: string;
};

type Column = {
  key: string;
  label: string;
  align?: 'left' | 'right';
};

type Action = {
  href: string;
  label: string;
  variant?: 'primary' | 'secondary';
};

type Tab = {
  href: string;
  label: string;
};

type OperationalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  status?: string;
  metrics?: Metric[];
  filters: Filter[];
  columns: Column[];
  rows?: Array<Record<string, string>>;
  actions?: Action[];
  tabs?: Tab[];
  emptyTitle?: string;
  emptyDescription?: string;
  integrationNotes?: string[];
};

export function OperationalPage({
  eyebrow,
  title,
  description,
  status = 'Pronto para integração',
  metrics = [],
  filters,
  columns,
  rows = [],
  actions = [],
  tabs = [],
  emptyTitle = 'Nenhum registro carregado',
  emptyDescription = 'A estrutura visual está pronta para receber dados reais da API.',
  integrationNotes = [],
}: Readonly<OperationalPageProps>) {
  return (
    <div className="page-stack">
      <section className="page-hero operational-hero">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <div className="title-row">
            <h1>{title}</h1>
            <span className="status-badge">{status}</span>
          </div>
          <p>{description}</p>
        </div>
        {actions.length > 0 ? (
          <div className="page-actions">
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className={`button ${action.variant === 'secondary' ? 'button-secondary' : 'button-primary'}`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {metrics.length > 0 ? (
        <section className="metric-grid" aria-label="Indicadores da página">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value ?? '—'}</strong>
              <small>{metric.helper}</small>
            </article>
          ))}
        </section>
      ) : null}

      {tabs.length > 0 ? (
        <nav className="page-tabs" aria-label="Seções relacionadas">
          {tabs.map((tab) => (
            <Link href={tab.href} key={tab.href}>
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <section className="data-panel">
        <div className="data-toolbar">
          <div>
            <span className="eyebrow">Consulta operacional</span>
            <h2>Registros</h2>
          </div>
          <span className="result-count">
            {rows.length > 0 ? `${rows.length} carregados` : 'Aguardando dados'}
          </span>
        </div>

        <form className="filter-grid" aria-label={`Filtros de ${title}`}>
          <label className="filter-field filter-search">
            <span>Busca</span>
            <input name="q" type="search" placeholder="Buscar por nome, código ou referência" />
          </label>
          {filters.map((filter) => (
            <label className="filter-field" key={filter.name}>
              <span>{filter.label}</span>
              {filter.options ? (
                <select name={filter.name} defaultValue="">
                  <option value="">Todos</option>
                  {filter.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input name={filter.name} placeholder={filter.placeholder ?? 'Filtrar'} />
              )}
            </label>
          ))}
          <div className="filter-actions">
            <button className="button button-secondary" type="button">
              Limpar
            </button>
            <button className="button button-primary" type="button">
              Aplicar filtros
            </button>
          </div>
        </form>

        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={column.align === 'right' ? 'align-right' : undefined}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row, index) => (
                  <tr key={row.id ?? String(index)}>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={column.align === 'right' ? 'align-right' : undefined}
                      >
                        {column.key === 'status' ? (
                          <span className="table-status">{row[column.key]}</span>
                        ) : (
                          row[column.key]
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="table-empty">
                      <span className="empty-icon" aria-hidden="true">
                        NX
                      </span>
                      <div>
                        <strong>{emptyTitle}</strong>
                        <p>{emptyDescription}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="table-footer">
          <span>Paginação preparada para cursor/offset da API.</span>
          <div className="pager" aria-label="Paginação">
            <button type="button" disabled>
              Anterior
            </button>
            <span>Página 1</span>
            <button type="button" disabled>
              Próxima
            </button>
          </div>
        </footer>
      </section>

      <section className="readiness-panel">
        <div>
          <span className="eyebrow">Contrato de evolução</span>
          <h2>Página preparada para produção</h2>
          <p>
            Os pontos abaixo já têm lugar definido na interface e podem ser conectados sem redesenho
            estrutural.
          </p>
        </div>
        <div className="readiness-grid">
          <article>
            <strong>API & dados</strong>
            <span>Filtros, paginação, ordenação, detalhe e mutações.</span>
          </article>
          <article>
            <strong>Segurança</strong>
            <span>TenantContext, RBAC, ações condicionais e escopo por perfil.</span>
          </article>
          <article>
            <strong>Auditoria</strong>
            <span>created/updated, lifecycle, soft delete e histórico operacional.</span>
          </article>
          <article>
            <strong>UX operacional</strong>
            <span>Loading, vazio, erro, feedback, atalhos e responsividade.</span>
          </article>
          {integrationNotes.map((note) => (
            <article key={note}>
              <strong>Integração</strong>
              <span>{note}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
