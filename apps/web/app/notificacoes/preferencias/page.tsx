import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Preferências de notificações' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Notificações • Preferências"
      title="Preferências"
      description="Preferências por usuário, evento e canal, respeitando escopo do tenant e políticas obrigatórias."
      filters={[
        { label: 'Canal', name: 'channel', options: ['Interna', 'E-mail', 'SMS', 'WhatsApp'] },
        { label: 'Evento', name: 'event' },
        { label: 'Estado', name: 'status', options: ['Ativa', 'Desativada', 'Obrigatória'] },
      ]}
      columns={[
        { key: 'event', label: 'Evento' },
        { key: 'channel', label: 'Canal' },
        { key: 'audience', label: 'Destinatário' },
        { key: 'scope', label: 'Escopo' },
        { key: 'status', label: 'Estado' },
      ]}
      integrationNotes={['Eventos obrigatórios de segurança/compliance não poderão ser desabilitados por preferência de usuário.']}
    />
  );
}
