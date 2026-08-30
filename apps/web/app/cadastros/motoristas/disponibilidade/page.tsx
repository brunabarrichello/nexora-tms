import { OperationalPage } from '../../../_components/operational-page';
export const metadata = { title: 'Disponibilidade de motoristas' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Motoristas • Wave 0017"
      title="Disponibilidade"
      description="Agenda e estado operacional de motoristas para matching e programação."
      filters={[
        {
          label: 'Estado',
          name: 'state',
          options: ['Disponível', 'Reservado', 'Em viagem', 'Indisponível'],
        },
        { label: 'UF base', name: 'uf' },
      ]}
      columns={[
        { key: 'driver', label: 'Motorista' },
        { key: 'base', label: 'Base' },
        { key: 'availableFrom', label: 'Disponível a partir de' },
        { key: 'until', label: 'Até' },
        { key: 'status', label: 'Estado' },
      ]}
    />
  );
}
