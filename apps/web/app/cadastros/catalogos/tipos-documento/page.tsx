import { OperationalPage } from '../../../_components/operational-page';
export const metadata = { title: 'Tipos de documento' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Catálogos • document_types"
      title="Tipos de documento"
      description="Tipos documentais por escopo, validade e necessidade de validação."
      filters={[
        {
          label: 'Escopo',
          name: 'scope',
          options: ['party', 'driver', 'asset', 'request', 'trip', 'financial', 'other'],
        },
        { label: 'Status', name: 'status', options: ['Ativo', 'Inativo'] },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'scope', label: 'Escopo' },
        { key: 'rules', label: 'Validade / validação' },
        { key: 'status', label: 'Status' },
      ]}
      integrationNotes={['Persistência já prevista em document_types com RLS por tenant.']}
    />
  );
}
