import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Eventos de cargas' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Cargas • Wave 0019"
      title="Eventos e histórico"
      description="Timeline de status e eventos operacionais das cargas, preservando histórico auditável."
      filters={[
        { label: 'Evento', name: 'event' },
        { label: 'Carga', name: 'load' },
        { label: 'Período', name: 'period' },
      ]}
      columns={[
        { key: 'occurredAt', label: 'Data/hora' },
        { key: 'load', label: 'Carga' },
        { key: 'event', label: 'Evento' },
        { key: 'actor', label: 'Origem' },
        { key: 'status', label: 'Resultado' },
      ]}
    />
  );
}
