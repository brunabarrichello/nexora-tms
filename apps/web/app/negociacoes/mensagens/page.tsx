import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Mensagens de Negociação' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Histórico comercial"
      title="Mensagens de Negociação"
      description="Linha do tempo de mensagens comerciais e operacionais trocadas durante a negociação, sem substituir o registro formal de propostas e contrapropostas."
      metrics={[
        { label: 'Mensagens', helper: 'Histórico registrado' },
        { label: 'Hoje', helper: 'Atividade do dia' },
        { label: 'Pendentes', helper: 'Conversas aguardando retorno' },
        { label: 'Sistema', helper: 'Eventos automáticos contextualizados' },
      ]}
      filters={[
        { label: 'Tipo', name: 'type', options: ['message', 'note', 'system'] },
        { label: 'Conversa', name: 'thread', placeholder: 'ID da conversa' },
        { label: 'Autor', name: 'author', placeholder: 'Participante' },
      ]}
      columns={[
        { key: 'createdAt', label: 'Data/hora' },
        { key: 'thread', label: 'Conversa' },
        { key: 'author', label: 'Autor' },
        { key: 'type', label: 'Tipo' },
        { key: 'message', label: 'Mensagem' },
        { key: 'status', label: 'Estado' },
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
        'Fonte planejada: negotiation_messages.',
        'Mensagens devem ser históricas; correções futuras não devem reescrever o contexto comercial já ocorrido.',
      ]}
    />
  );
}
