import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Entregas de notificações' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Notificações • Delivery state"
      title="Entregas"
      description="Acompanhamento de tentativas, canais, provedores e resultado de entrega das notificações."
      filters={[
        { label: 'Canal', name: 'channel', options: ['E-mail', 'SMS', 'WhatsApp', 'Webhook'] },
        { label: 'Estado', name: 'status', options: ['Pendente', 'Processando', 'Entregue', 'Falha', 'Descartada'] },
        { label: 'Provedor', name: 'provider' },
      ]}
      columns={[
        { key: 'notification', label: 'Notificação' },
        { key: 'channel', label: 'Canal' },
        { key: 'provider', label: 'Provedor' },
        { key: 'attempts', label: 'Tentativas' },
        { key: 'status', label: 'Status' },
      ]}
      integrationNotes={['Retentativas devem ser idempotentes e conservar correlação com o evento que originou a notificação.']}
    />
  );
}
