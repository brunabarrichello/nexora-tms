import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Marcos de viagens' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Trips • Milestones"
      title="Marcos"
      description="Milestones planejados e realizados para acompanhamento do progresso físico da viagem."
      filters={[
        { label: 'Marco', name: 'milestone' },
        { label: 'Estado', name: 'status', options: ['Pendente', 'No prazo', 'Atrasado', 'Concluído'] },
        { label: 'Viagem', name: 'trip' },
      ]}
      columns={[
        { key: 'trip', label: 'Viagem' },
        { key: 'milestone', label: 'Marco' },
        { key: 'plannedAt', label: 'Planejado' },
        { key: 'occurredAt', label: 'Realizado' },
        { key: 'status', label: 'Estado' },
      ]}
    />
  );
}
