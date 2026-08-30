import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Conversas de Negociação' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Negociação complementar"
      title="Conversas de Negociação"
      description="Threads comerciais vinculadas à carga e ao processo de contratação, mantendo propostas formais separadas das mensagens operacionais."
      metrics={[
        { label: 'Conversas abertas', helper: 'Threads em andamento' },
        { label: 'Aguardando resposta', helper: 'Última mensagem sem retorno' },
        { label: 'Encerradas', helper: 'Negociações finalizadas' },
        { label: 'Com proposta ativa', helper: 'Vínculo comercial vigente' },
      ]}
      filters={[
        { label: 'Status', name: 'status', options: ['open', 'closed', 'cancelled'] },
        { label: 'Carga', name: 'request', placeholder: 'ID ou referência da carga' },
        { label: 'Participante', name: 'participant', placeholder: 'Transportadora ou contato' },
      ]}
      columns={[
        { key: 'thread', label: 'Conversa' },
        { key: 'request', label: 'Carga' },
        { key: 'participants', label: 'Participantes' },
        { key: 'lastMessage', label: 'Última mensagem' },
        { key: 'updatedAt', label: 'Atualizada em' },
        { key: 'status', label: 'Status' },
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
        'Fonte planejada: negotiation_threads, sem substituir freight_proposals.',
        'Cada conversa ficará vinculada ao tenant e à solicitação de transporte correspondente.',
      ]}
    />
  );
}
