import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Veículos e ativos' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Cadastros • Motoristas e ativos"
      title="Veículos e ativos"
      description="Frota própria ou parceira com tipo, carroceria, capacidades, disponibilidade, manutenção, seguro e inspeções."
      actions={[{ href: '/cadastros/veiculos/novo', label: 'Novo veículo' }]}
      metrics={[
        { label: 'Disponíveis', helper: 'Disponibilidade da frota' },
        { label: 'Em manutenção', helper: 'Agenda de manutenção' },
        { label: 'Documentos regulares', helper: 'Validação documental' },
      ]}
      filters={[
        {
          label: 'Tipo',
          name: 'type',
          options: ['Utilitário', '3/4', 'Toco', 'Truck', 'Carreta', 'Bitrem'],
        },
        {
          label: 'Carroceria',
          name: 'body',
          options: ['Baú', 'Sider', 'Grade baixa', 'Graneleiro', 'Prancha'],
        },
        {
          label: 'Status',
          name: 'status',
          options: ['Disponível', 'Em viagem', 'Manutenção', 'Bloqueado'],
        },
      ]}
      columns={[
        { key: 'plate', label: 'Placa' },
        { key: 'type', label: 'Tipo' },
        { key: 'body', label: 'Carroceria' },
        { key: 'capacity', label: 'Capacidade' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
