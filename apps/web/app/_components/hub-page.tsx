import Link from 'next/link';

type HubItem = {
  href: string;
  title: string;
  description: string;
  badge?: string;
};

type HubPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: HubItem[];
};

export function HubPage({ eyebrow, title, description, items }: Readonly<HubPageProps>) {
  return (
    <div className="page-stack">
      <section className="page-hero operational-hero">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span className="status-badge">{items.length} áreas mapeadas</span>
      </section>
      <section className="hub-grid">
        {items.map((item, index) => (
          <Link className="hub-card" href={item.href} key={item.href}>
            <div className="hub-card-top">
              <span className="hub-index">{String(index + 1).padStart(2, '0')}</span>
              {item.badge ? <span className="mini-badge">{item.badge}</span> : null}
            </div>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <span className="hub-link">Abrir área →</span>
          </Link>
        ))}
      </section>
      <section className="readiness-panel compact-readiness">
        <div>
          <span className="eyebrow">Padrão Nexora</span>
          <h2>Navegação modular e evolutiva</h2>
          <p>
            Cada área possui rota própria, contrato visual consistente e espaço reservado para API,
            permissões, auditoria e lifecycle.
          </p>
        </div>
      </section>
    </div>
  );
}
