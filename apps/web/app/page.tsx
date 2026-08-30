import Link from 'next/link';

const roadmap = [
  { label: 'Cadastros', status: 'Em construção', detail: 'Base mestre e cadastros operacionais' },
  { label: 'Cargas', status: 'Planejado', detail: 'Itens, volumes, requisitos e eventos' },
  { label: 'Matching', status: 'Planejado', detail: 'Compatibilidade persistente e explicável' },
  { label: 'Negociação', status: 'Planejado', detail: 'Ofertas, contrapropostas e aceite' },
  { label: 'Viagens', status: 'Planejado', detail: 'Execução, tracking, POD e custos' },
];

const shortcuts = [
  {
    href: '/cadastros',
    label: 'Abrir Cadastros',
    description: 'Empresas, clientes, motoristas, ativos e locais.',
  },
  {
    href: '/cargas',
    label: 'Abrir Cargas',
    description: 'Estrutura preparada para a próxima wave funcional.',
  },
  {
    href: '/documentos',
    label: 'Abrir Documentos',
    description: 'Core documental, versões e validações.',
  },
];

export default function HomePage() {
  return (
    <div className="page-stack">
      <section className="page-hero dashboard-hero">
        <div>
          <span className="eyebrow">Operação</span>
          <h1>Visão operacional</h1>
          <p>
            Acompanhe a evolução do Nexora TMS e acesse os módulos que formarão o fluxo Cadastros →
            Cargas → Matching → Negociação → Viagens.
          </p>
        </div>
        <Link className="button button-primary" href="/cadastros">
          Ir para Cadastros
        </Link>
      </section>

      <section className="metric-grid" aria-label="Indicadores da fundação">
        <article className="metric-card">
          <span>Módulo atual</span>
          <strong>Cadastros</strong>
          <small>Primeira camada funcional</small>
        </article>
        <article className="metric-card">
          <span>Banco</span>
          <strong>Wave 0015+</strong>
          <small>Catálogos fundacionais em evolução</small>
        </article>
        <article className="metric-card">
          <span>Interface</span>
          <strong>Foundation</strong>
          <small>Shell e páginas em construção</small>
        </article>
        <article className="metric-card">
          <span>Arquitetura</span>
          <strong>Multi-tenant</strong>
          <small>Preparada para integração progressiva</small>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Roadmap operacional</span>
              <h2>Sequência de implantação</h2>
            </div>
          </div>
          <div className="roadmap-list">
            {roadmap.map((item, index) => (
              <div className="roadmap-item" key={item.label}>
                <span className="roadmap-number">{String(index + 1).padStart(2, '0')}</span>
                <div className="roadmap-copy">
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
                <span className="status-badge">{item.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Acesso rápido</span>
              <h2>Próximas áreas</h2>
            </div>
          </div>
          <div className="shortcut-list">
            {shortcuts.map((item) => (
              <Link className="shortcut-card" href={item.href} key={item.href}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </div>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
