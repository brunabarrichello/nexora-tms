import { OperationalPage } from '../../../_components/operational-page';
export const metadata = { title: 'Seguros de veículos' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Ativos • Wave 0017"
      title="Seguros"
      description="Apólices, coberturas, vigência e evidências vinculadas a veículos e ativos."
      filters={[
        { label: 'Validade', name: 'validity', options: ['Válido', 'A vencer', 'Vencido'] },
        { label: 'Seguradora', name: 'insurer' },
      ]}
      columns={[
        { key: 'vehicle', label: 'Veículo' },
        { key: 'policy', label: 'Apólice' },
        { key: 'insurer', label: 'Seguradora' },
        { key: 'expiresAt', label: 'Validade' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
