import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Equipamentos' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Capacidade • Equipamentos"
      title="Equipamentos"
      description="Equipamentos e acessórios operacionais disponíveis para composição de capacidade e requisitos de transporte."
      filters={[
        { label: 'Categoria', name: 'category' },
        { label: 'Disponibilidade', name: 'availability', options: ['Disponível', 'Em uso', 'Manutenção', 'Indisponível'] },
        { label: 'Unidade', name: 'unit' },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Equipamento' },
        { key: 'category', label: 'Categoria' },
        { key: 'unit', label: 'Unidade' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
