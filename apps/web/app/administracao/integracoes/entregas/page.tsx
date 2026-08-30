import { OperationalPage } from '../../../_components/operational-page';

export const metadata = { title: 'Entregas de integrações' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Integrations • Delivery logs"
      title="Entregas de integrações"
      description="Logs funcionais de entregas, tentativas e falhas de adapters/webhooks com correlação e idempotência."
      filters={[
        { label: 'Integração', name: 'integration' },
        {
          label: 'Estado',
          name: 'status',
          options: ['Pendente', 'Sucesso', 'Falha', 'Retentativa'],
        },
        { label: 'Evento', name: 'event' },
      ]}
      columns={[
        { key: 'occurredAt', label: 'Data/hora' },
        { key: 'integration', label: 'Integração' },
        { key: 'event', label: 'Evento' },
        { key: 'correlationId', label: 'Correlação' },
        { key: 'status', label: 'Estado' },
      ]}
      integrationNotes={[
        'Logs funcionais não devem armazenar tokens, payloads sensíveis ou credenciais do provedor.',
      ]}
    />
  );
}
