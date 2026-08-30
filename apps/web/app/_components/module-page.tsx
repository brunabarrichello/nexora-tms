import Link from 'next/link';

type ModulePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: 'Em construção' | 'Próximo' | 'Planejado';
  highlights: Array<{ title: string; description: string }>;
  primaryAction?: { href: string; label: string };
};

export function ModulePage({
  eyebrow,
  title,
  description,
  status,
  highlights,
  primaryAction,
}: Readonly<ModulePageProps>) {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <div className="title-row">
            <h1>{title}</h1>
            <span className="status-badge">{status}</span>
          </div>
          <p>{description}</p>
        </div>
        {primaryAction ? (
          <Link href={primaryAction.href} className="button button-primary">
            {primaryAction.label}
          </Link>
        ) : null}
      </section>

      <section className="card-grid card-grid-3">
        {highlights.map((item) => (
          <article className="feature-card" key={item.title}>
            <span className="feature-index">
              {String(highlights.indexOf(item) + 1).padStart(2, '0')}
            </span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </article>
        ))}
      </section>

      <section className="empty-state">
        <div>
          <span className="eyebrow">Integração progressiva</span>
          <h2>Pronto para receber dados reais</h2>
          <p>
            Esta página já faz parte da navegação oficial. Tabelas, filtros, formulários, permissões
            e APIs serão conectados conforme a wave correspondente for concluída.
          </p>
        </div>
      </section>
    </div>
  );
}
