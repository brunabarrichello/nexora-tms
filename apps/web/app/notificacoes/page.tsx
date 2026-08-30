import { OperationalPage } from '../_components/operational-page';

export const metadata = { title: 'Notificações' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Capacidade transversal • Notifications"
      title="Notificações"
      description="Central de notificações internas e entregas externas, desacoplada dos módulos que originam os eventos."
      metrics={[
        { label: 'Não lidas', helper: 'Caixa do usuário' },
        { label: 'Pendentes de entrega', helper: 'Outbox de notificações' },
        { label: 'Falhas', helper: 'Tentativas com erro' },
        { label: 'Preferências ativas', helper: 'Configuração por canal' },
      ]}
      filters={[
        { label: 'Canal', name: 'channel', options: ['Interna', 'E-mail', 'SMS', 'WhatsApp', 'Webhook'] },
        { label: 'Estado', name: 'status', options: ['Nova', 'Lida', 'Pendente', 'Entregue', 'Falha'] },
        { label: 'Módulo', name: 'module' },
      ]}
      columns={[
        { key: 'createdAt', label: 'Data/hora' },
        { key: 'subject', label: 'Assunto' },
        { key: 'module', label: 'Origem' },
        { key: 'channel', label: 'Canal' },
        { key: 'status', label: 'Status' },
      ]}
      tabs={[
        { href: '/notificacoes', label: 'Caixa' },
        { href: '/notificacoes/entregas', label: 'Entregas' },
        { href: '/notificacoes/preferencias', label: 'Preferências' },
      ]}
      integrationNotes={['Notifications consome eventos versionados e não deve se tornar dependência central dos módulos de negócio.']}
    />
  );
}
