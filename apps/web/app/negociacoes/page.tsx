import { OperationalPage } from '../_components/operational-page';
export const metadata = { title: 'Negociação' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Operação comercial"
      title="Negociação"
      description="Negociações de frete com propostas, contrapropostas, participantes, prazos e decisão auditável."
      metrics={[
        { label: 'Abertas', helper: 'Negociações em andamento' },
        { label: 'Aguardando resposta', helper: 'Última ação por participante' },
        { label: 'Aceitas', helper: 'Prontas para viagem' },
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
      tabs={[
        { href: '/negociacoes', label: 'Negociações' },
        { href: '/negociacoes/reservas', label: 'Reservas' },
        { href: '/negociacoes/contratos', label: 'Contratos' },
      ]}
      integrationNotes={[
        'Histórico de propostas será imutável; decisão final gerará vínculo formal para viagem.',
      ]}
    />
  );
}
