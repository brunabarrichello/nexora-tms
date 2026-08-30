import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Perfis e permissões' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Administração • RBAC"
      title="Perfis e permissões"
      description="Tela preparada para papéis, permissões, escopos e atribuições de acesso."
      status="RBAC pendente"
      filters={[
        { label: 'Escopo', name: 'scope', options: ['Tenant', 'Unidade', 'Módulo'] },
        { label: 'Status', name: 'status', options: ['Ativo', 'Inativo'] },
      ]}
      columns={[
        { key: 'role', label: 'Perfil' },
        { key: 'scope', label: 'Escopo' },
        { key: 'permissions', label: 'Permissões' },
        { key: 'members', label: 'Usuários' },
        { key: 'status', label: 'Status' },
      ]}
      integrationNotes={[
        'A UI somente consumirá decisões de autorização do backend; não será fonte de verdade de permissão.',
      ]}
    />
  );
}
