import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Grupos' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Cadastros • Wave 0016"
      title="Grupos"
      description="Agrupamentos reutilizáveis para clientes, parceiros, ativos, operação e políticas."
      filters={[
        { label: 'Tipo', name: 'type' },
        { label: 'Status', name: 'status', options: ['Ativo', 'Inativo'] },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'type', label: 'Tipo' },
        { key: 'members', label: 'Membros' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
