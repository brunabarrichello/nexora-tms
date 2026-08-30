import { OperationalPage } from '../../../_components/operational-page';

export const metadata = { title: 'Webhooks' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Integrations • Webhooks"
      title="Webhooks"
      description="Assinaturas de eventos externos com endpoint, versão de contrato e estado, sem exposição de segredos."
      filters={[
        { label: 'Evento', name: 'event' },
        { label: 'Estado', name: 'status', options: ['Ativo', 'Pausado', 'Erro', 'Inativo'] },
        { label: 'Integração', name: 'integration' },
      ]}
      columns={[
        { key: 'event', label: 'Evento' },
        { key: 'integration', label: 'Integração' },
        { key: 'endpoint', label: 'Endpoint seguro' },
        { key: 'version', label: 'Versão' },
        { key: 'status', label: 'Estado' },
      ]}
      integrationNotes={['Chaves de assinatura e secrets nunca serão retornados pela API de consulta.']}
    />
  );
}
