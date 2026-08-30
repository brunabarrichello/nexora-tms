import { HubPage } from '../_components/hub-page';
export const metadata = { title: 'Administração' };
export default function Page() {
  return (
    <HubPage
      eyebrow="Sistema"
      title="Administração"
      description="Governança da plataforma, preparada para identidade, autorização, tenant, auditoria e configurações."
      items={[
        {
          href: '/administracao/usuarios',
          title: 'Usuários',
          description: 'Usuários, identidades externas e memberships.',
          badge: 'Pendente estrutural',
        },
        {
          href: '/administracao/perfis-permissoes',
          title: 'Perfis e permissões',
          description: 'RBAC, papéis, permissões e escopos.',
          badge: 'Pendente estrutural',
        },
        {
          href: '/administracao/configuracoes',
          title: 'Configurações',
          description: 'Preferências operacionais, catálogos e parâmetros do tenant.',
        },
        {
          href: '/administracao/integracoes',
          title: 'Integrações',
          description: 'Adapters externos, estado e governança de conexões.',
        },
        {
          href: '/administracao/auditoria',
          title: 'Auditoria',
          description: 'Trilha transversal de eventos administrativos e operacionais.',
          badge: 'Wave 0024',
        },
        {
          href: '/cadastros/empresas',
          title: 'Empresa e unidades',
          description: 'Contexto organizacional e lifecycle do tenant.',
        },
      ]}
    />
  );
}
