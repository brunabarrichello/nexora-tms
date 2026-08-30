import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Integrações' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Administração • Adapters"
      title="Integrações"
      description="Catálogo de integrações externas, webhooks, credenciais referenciadas e estado de saúde."
      filters={[
        {
          label: 'Categoria',
          name: 'category',
          options: [
            'Identidade',
            'Tracking',
            'Mapas',
            'Mensageria',
            'Fiscal',
            'Financeiro',
            'Outros',
          ],
        },
        {
          label: 'Estado',
          name: 'status',
          options: ['Configurada', 'Pendente', 'Desabilitada', 'Erro'],
        },
      ]}
      columns={[
        { key: 'integration', label: 'Integração' },
        { key: 'category', label: 'Categoria' },
        { key: 'environment', label: 'Ambiente' },
        { key: 'lastCheck', label: 'Última verificação' },
        { key: 'status', label: 'Estado' },
      ]}
      tabs={[
        { href: '/administracao/integracoes', label: 'Adapters' },
        { href: '/administracao/integracoes/webhooks', label: 'Webhooks' },
        { href: '/administracao/integracoes/entregas', label: 'Entregas' },
      ]}
      integrationNotes={[
        'Secrets permanecerão exclusivamente em secret stores; a interface mostrará apenas metadados seguros.',
      ]}
    />
  );
}
