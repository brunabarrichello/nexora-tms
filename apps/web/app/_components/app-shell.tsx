import Link from 'next/link';
import type { ReactNode } from 'react';

const primaryNavigation = [
  { href: '/', label: 'Dashboard', short: 'DB' },
  { href: '/cadastros', label: 'Cadastros', short: 'CD' },
  { href: '/cargas', label: 'Cargas', short: 'CG' },
  { href: '/matching', label: 'Matching', short: 'MT' },
  { href: '/negociacoes', label: 'Negociação', short: 'NG' },
  { href: '/viagens', label: 'Viagens', short: 'VG' },
  { href: '/documentos', label: 'Documentos', short: 'DC' },
  { href: '/ocorrencias', label: 'Ocorrências', short: 'OC' },
  { href: '/financeiro', label: 'Financeiro', short: 'FN' },
  { href: '/notificacoes', label: 'Notificações', short: 'NT' },
  { href: '/relatorios', label: 'Relatórios', short: 'RL' },
];

const secondaryNavigation = [
  { href: '/administracao', label: 'Administração' },
  { href: '/administracao/auditoria', label: 'Auditoria' },
  { href: '/administracao/configuracoes', label: 'Configurações' },
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const environment = process.env.NEXORA_ENVIRONMENT?.trim() || 'Development';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            N
          </div>
          <div>
            <strong>Nexora</strong>
            <span>Transportation Management</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Navegação principal">
          {primaryNavigation.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              <span className="nav-icon" aria-hidden="true">
                {item.short}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-section-label">Sistema</div>
        <nav className="secondary-nav" aria-label="Navegação administrativa">
          {secondaryNavigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="environment-dot" aria-hidden="true" />
          <div>
            <strong>{environment}</strong>
            <span>Auth0 + sessão Web segura</span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="topbar-kicker">Nexora TMS</span>
            <strong>Central Operacional</strong>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <span className="sr-only">Busca global</span>
              <input type="search" placeholder="Buscar no Nexora" />
            </label>
            <span className="tenant-chip">Tenant: contexto autenticado</span>
            <Link className="button" href="/auth/logout">
              Sair
            </Link>
            <div className="avatar" aria-label="Sessão autenticada">
              NX
            </div>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
