import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Participantes da Negociação' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Relacionamento comercial"
      title="Participantes da Negociação"
      description="Participantes vinculados às conversas comerciais, com papel, organização representada e estado de participação no processo."
      metrics={[
        { label: 'Participantes ativos', helper: 'Pessoas e organizações nas threads' },
        { label: 'Transportadoras', helper: 'Parceiros negociando capacidade' },
        { label: 'Operadores internos', helper: 'Equipe Nexora/tenant' },
        { label: 'Removidos', helper: 'Histórico preservado' },
      ]}
      filters={[
        {
          label: 'Papel',
          name: 'role',
          options: ['operator', 'carrier', 'driver', 'commercial', 'observer'],
        },
        { label: 'Conversa', name: 'thread', placeholder: 'ID da conversa' },
        { label: 'Nome', name: 'name', placeholder: 'Pessoa ou organização' },
      ]}
      columns={[
        { key: 'name', label: 'Participante' },
        { key: 'organization', label: 'Organização' },
        { key: 'role', label: 'Papel' },
        { key: 'thread', label: 'Conversa' },
        { key: 'joinedAt', label: 'Entrada' },
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
        'Fonte planejada: negotiation_participants.',
        'Participação histórica será preservada mesmo após encerramento da thread.',
      ]}
    />
  );
}
