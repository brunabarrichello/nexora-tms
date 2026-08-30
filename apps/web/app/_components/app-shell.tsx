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
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">N</div>
          <div>
            <strong>Nexora</strong>
            <span>Transportation Management</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Navegação principal">
          {primaryNavigation.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              <span className="nav-icon" aria-hidden="true">{item.short}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="environment-dot" aria-hidden="true" />
          <div>
            <strong>Development</strong>
            <span>Interface inicial</span>
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
            <span className="tenant-chip">Tenant: demonstração</span>
            <div className="avatar" aria-label="Perfil do usuário">NX</div>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
