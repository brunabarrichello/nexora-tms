import { OperationalPage } from '../../../_components/operational-page';
export const metadata = { title: 'Tipos de carroceria' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Catálogos • body_types"
      title="Tipos de carroceria"
      description="Catálogo tenant-scoped com fechamento e suporte a carregamento lateral/traseiro."
      filters={[
        { label: 'Status', name: 'status', options: ['Ativo', 'Inativo'] },
        { label: 'Fechada', name: 'closed', options: ['Sim', 'Não'] },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'loading', label: 'Carregamento' },
        { key: 'status', label: 'Status' },
      ]}
      integrationNotes={['Persistência já prevista em body_types com RLS por tenant.']}
    />
  );
}
