import { OperationalPage } from '../../../_components/operational-page';
export const metadata = { title: 'Unidades de medida' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Catálogos • units_of_measure"
      title="Unidades de medida"
      description="Unidades globais para massa, volume, comprimento, contagem, tempo e outras dimensões."
      filters={[
        {
          label: 'Dimensão',
          name: 'dimension',
          options: ['mass', 'volume', 'length', 'count', 'time', 'other'],
        },
        { label: 'Status', name: 'status', options: ['Ativo', 'Inativo'] },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'dimension', label: 'Dimensão' },
        { key: 'status', label: 'Status' },
      ]}
      integrationNotes={['Catálogo global; a UI não deve enviar tenant_id para units_of_measure.']}
    />
  );
}
