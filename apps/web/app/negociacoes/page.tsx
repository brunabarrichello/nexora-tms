import { OperationalPage } from '../_components/operational-page';

export const metadata = { title: 'Negociação' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Operação comercial"
      title="Negociação"
      description="Central de negociação de frete com conversas, participantes, mensagens, propostas, reservas, contratos e decisão comercial rastreável."
      metrics={[
        { label: 'Abertas', helper: 'Negociações em andamento' },
        { label: 'Aguardando resposta', helper: 'Última ação por participante' },
        { label: 'Aceitas', helper: 'Prontas para contratação/viagem' },
        { label: 'Expirando', helper: 'SLA configurável' },
      ]}
      filters={[
        {
          label: 'Status',
          name: 'status',
          options: ['Aberta', 'Aguardando', 'Aceita', 'Recusada', 'Expirada', 'Cancelada'],
        },
        { label: 'Participante', name: 'participant' },
        { label: 'Carga', name: 'load' },
      ]}
      columns={[
        { key: 'code', label: 'Negociação' },
        { key: 'load', label: 'Carga' },
        { key: 'participant', label: 'Participante' },
        { key: 'offer', label: 'Última proposta' },
        { key: 'status', label: 'Status' },
      ]}
      actions={[
        { href: '/negociacoes/conversas', label: 'Ver conversas' },
        { href: '/matching/propostas', label: 'Ver propostas', variant: 'secondary' },
      ]}
      tabs={[
        { href: '/negociacoes', label: 'Visão geral' },
        { href: '/negociacoes/conversas', label: 'Conversas' },
        { href: '/negociacoes/participantes', label: 'Participantes' },
        { href: '/negociacoes/mensagens', label: 'Mensagens' },
        { href: '/matching/propostas', label: 'Propostas' },
        { href: '/negociacoes/reservas', label: 'Reservas' },
        { href: '/negociacoes/contratos', label: 'Contratos' },
      ]}
      integrationNotes={[
        'Wave 0021 adicionará negotiation_threads, negotiation_participants e negotiation_messages sem duplicar freight_proposals.',
        'Reservas e contratos permanecem nas estruturas canônicas existentes e continuam o fluxo após a decisão comercial.',
      ]}
    />
  );
}
