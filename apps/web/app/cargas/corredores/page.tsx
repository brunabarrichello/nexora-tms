import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Freight lanes' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Cargas • Wave 0019"
      title="Freight lanes"
      description="Corredores recorrentes entre origens e destinos para histórico, referência comercial e inteligência operacional."
      filters={[
        { label: 'Origem', name: 'origin' },
        { label: 'Destino', name: 'destination' },
        { label: 'Status', name: 'status', options: ['Ativo', 'Inativo'] },
      ]}
      columns={[
        { key: 'code', label: 'Corredor' },
        { key: 'origin', label: 'Origem' },
        { key: 'destination', label: 'Destino' },
        { key: 'loads', label: 'Cargas relacionadas' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
