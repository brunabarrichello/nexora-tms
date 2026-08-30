import { OperationalPage } from '../../../_components/operational-page';
export const metadata = { title: 'Manutenções' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Ativos • Wave 0017"
      title="Manutenções"
      description="Planos, ordens e histórico de manutenção preventiva/corretiva da frota."
      filters={[
        { label: 'Tipo', name: 'type', options: ['Preventiva', 'Corretiva'] },
        {
          label: 'Status',
          name: 'status',
          options: ['Programada', 'Em execução', 'Concluída', 'Cancelada'],
        },
      ]}
      columns={[
        { key: 'vehicle', label: 'Veículo' },
        { key: 'type', label: 'Tipo' },
        { key: 'scheduledAt', label: 'Programada' },
        { key: 'provider', label: 'Fornecedor' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
