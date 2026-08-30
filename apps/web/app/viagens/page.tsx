import { OperationalPage } from '../_components/operational-page';
export const metadata = { title: 'Viagens' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Execução"
      title="Viagens"
      description="Planejamento e execução ponta a ponta com veículo, motorista, rota, tracking, despesas, POD e encerramento."
      actions={[{ href: '/viagens/nova', label: 'Nova viagem' }]}
      metrics={[
        { label: 'Programadas', helper: 'Aguardando início' },
        { label: 'Em trânsito', helper: 'Execução ativa' },
        { label: 'Com ocorrência', helper: 'Eventos abertos' },
        { label: 'Aguardando POD', helper: 'Entrega sem comprovante' },
      ]}
      filters={[
        {
          label: 'Status',
          name: 'status',
          options: ['Planejada', 'Programada', 'Em trânsito', 'Entregue', 'Concluída', 'Cancelada'],
        },
        { label: 'Motorista', name: 'driver' },
        { label: 'Veículo', name: 'vehicle' },
        { label: 'Período', name: 'period' },
      ]}
      columns={[
        { key: 'code', label: 'Viagem' },
        { key: 'route', label: 'Rota' },
        { key: 'driver', label: 'Motorista' },
        { key: 'vehicle', label: 'Veículo' },
        { key: 'status', label: 'Status' },
      ]}
      tabs={[
        { href: '/viagens', label: 'Todas' },
        { href: '/viagens/paradas', label: 'Paradas' },
        { href: '/viagens/marcos', label: 'Marcos' },
        { href: '/viagens/tracking', label: 'Tracking' },
        { href: '/viagens/despesas', label: 'Despesas' },
        { href: '/viagens/pedagios', label: 'Pedágios' },
        { href: '/viagens/combustivel', label: 'Combustível' },
        { href: '/viagens/pod', label: 'POD' },
        { href: '/ocorrencias', label: 'Ocorrências' },
      ]}
      integrationNotes={[
        'Tracking, paradas, marcos, despesas, pedágios, combustível, POD e eventos serão sub-recursos da execução.',
      ]}
    />
  );
}
