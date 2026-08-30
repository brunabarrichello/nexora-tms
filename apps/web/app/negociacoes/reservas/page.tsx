import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Reservas de capacidade' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Matching • Reservations"
      title="Reservas"
      description="Reservas temporárias de capacidade derivadas de negociação para evitar dupla alocação durante a decisão."
      filters={[
        { label: 'Estado', name: 'status', options: ['Ativa', 'Convertida', 'Expirada', 'Cancelada'] },
        { label: 'Recurso', name: 'resource' },
        { label: 'Carga', name: 'load' },
      ]}
      columns={[
        { key: 'reservation', label: 'Reserva' },
        { key: 'load', label: 'Carga' },
        { key: 'resource', label: 'Capacidade' },
        { key: 'expiresAt', label: 'Expira em' },
        { key: 'status', label: 'Estado' },
      ]}
      integrationNotes={['Conversão em contrato deve ocorrer de forma idempotente e liberar reservas concorrentes incompatíveis.']}
    />
  );
}
