import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Histórico de status da viagem' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Viagens · Core"
      title="Histórico de status"
      description="Acompanhe o lifecycle canônico da viagem com transições append-only, responsável, motivo e timestamps preservados para rastreabilidade operacional."
      metrics={[
        { label: 'Planejadas', helper: 'Viagens em preparação' },
        { label: 'Prontas', helper: 'Liberadas para início' },
        { label: 'Em trânsito', helper: 'Execução iniciada' },
        { label: 'Finalizadas', helper: 'Concluídas ou canceladas' },
      ]}
      filters={[
        { label: 'Viagem', name: 'trip', placeholder: 'Código da viagem' },
        {
          label: 'Status destino',
          name: 'status',
          options: ['planned', 'ready', 'in_transit', 'completed', 'cancelled'],
        },
        { label: 'Responsável', name: 'actor' },
        { label: 'Período', name: 'period' },
      ]}
      columns={[
        { key: 'trip', label: 'Viagem' },
        { key: 'from', label: 'De' },
        { key: 'to', label: 'Para' },
        { key: 'actor', label: 'Responsável' },
        { key: 'reason', label: 'Motivo' },
        { key: 'createdAt', label: 'Data/hora' },
      ]}
      tabs={[
        { href: '/viagens', label: 'Visão geral' },
        { href: '/viagens/cargas', label: 'Cargas e contratos' },
        { href: '/viagens/paradas', label: 'Paradas' },
        { href: '/viagens/motoristas', label: 'Motoristas' },
        { href: '/viagens/ativos', label: 'Ativos' },
        { href: '/viagens/status', label: 'Histórico de status' },
      ]}
      integrationNotes={[
        'Fonte canônica: trip_status_history; o runtime pode inserir e consultar, nunca atualizar ou excluir histórico.',
        'Lifecycle Core: planned → ready → in_transit → completed, com cancelamento controlado antes do encerramento.',
        'Marcos detalhados de coleta/entrega e eventos de execução permanecem na Wave 0023.',
      ]}
    />
  );
}
