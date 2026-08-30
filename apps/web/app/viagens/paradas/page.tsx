import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Paradas de viagens' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Trips • Stops"
      title="Paradas"
      description="Sequência de coleta, entrega e pontos intermediários vinculados às viagens."
      filters={[
        { label: 'Tipo', name: 'type', options: ['Coleta', 'Entrega', 'Parada técnica', 'Outro'] },
        {
          label: 'Estado',
          name: 'status',
          options: ['Planejada', 'Em andamento', 'Concluída', 'Cancelada'],
        },
        { label: 'Viagem', name: 'trip' },
      ]}
      columns={[
        { key: 'sequence', label: 'Seq.' },
        { key: 'trip', label: 'Viagem' },
        { key: 'location', label: 'Local' },
        { key: 'window', label: 'Janela' },
        { key: 'status', label: 'Estado' },
      ]}
    />
  );
}
