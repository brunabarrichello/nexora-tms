import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Atribuições de capacidade' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Capacidade • Assignments"
      title="Atribuições"
      description="Vínculos temporais entre motoristas, veículos, equipamentos e parceiros, preparados para matching e viagens."
      filters={[
        {
          label: 'Tipo',
          name: 'type',
          options: ['Motorista ↔ Veículo', 'Veículo ↔ Equipamento', 'Parceiro ↔ Ativo'],
        },
        { label: 'Vigência', name: 'validity', options: ['Atual', 'Futura', 'Encerrada'] },
      ]}
      columns={[
        { key: 'source', label: 'Origem' },
        { key: 'target', label: 'Atribuído a' },
        { key: 'validFrom', label: 'Início' },
        { key: 'validUntil', label: 'Fim' },
        { key: 'status', label: 'Status' },
      ]}
      integrationNotes={[
        'A vigência do vínculo será considerada pelo matching e pela programação sem alterar o cadastro mestre do recurso.',
      ]}
    />
  );
}
