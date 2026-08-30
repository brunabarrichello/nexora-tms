import { OperationalPage } from '../../../_components/operational-page';
export const metadata = { title: 'Tipos de embalagem' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Catálogos • package_types"
      title="Tipos de embalagem"
      description="Espécies de embalagem/volume com comportamento padrão de empilhamento."
      filters={[
        { label: 'Status', name: 'status', options: ['Ativo', 'Inativo'] },
        { label: 'Empilhável', name: 'stackable', options: ['Sim', 'Não', 'Não definido'] },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'stackable', label: 'Empilhável padrão' },
        { key: 'status', label: 'Status' },
      ]}
      integrationNotes={['Persistência já prevista em package_types com RLS por tenant.']}
    />
  );
}
