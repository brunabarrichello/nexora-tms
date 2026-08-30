import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Cargas da viagem' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Viagens · Core"
      title="Cargas e contratos da viagem"
      description="Planeje quais solicitações contratadas compõem cada viagem, preservando o contrato confirmado, a ordem operacional e o histórico de remoções."
      metrics={[
        { label: 'Cargas vinculadas', helper: 'Vínculos ativos na viagem' },
        { label: 'Contratos confirmados', helper: 'Origem obrigatória do vínculo' },
        { label: 'Removidas do plano', helper: 'Histórico preservado' },
        { label: 'Sem viagem', helper: 'Contratações aguardando planejamento' },
      ]}
      filters={[
        { label: 'Viagem', name: 'trip', placeholder: 'Código da viagem' },
        { label: 'Carga', name: 'request', placeholder: 'Carga ou referência' },
        { label: 'Contrato', name: 'contract', placeholder: 'Contrato confirmado' },
        { label: 'Estado', name: 'state', options: ['Ativa', 'Removida'] },
      ]}
      columns={[
        { key: 'trip', label: 'Viagem' },
        { key: 'sequence', label: 'Ordem', align: 'right' },
        { key: 'request', label: 'Carga' },
        { key: 'contract', label: 'Contrato' },
        { key: 'route', label: 'Rota' },
        { key: 'state', label: 'Estado' },
      ]}
      tabs={[
        { href: '/viagens', label: 'Visão geral' },
        { href: '/viagens/cargas', label: 'Cargas e contratos' },
        { href: '/viagens/paradas', label: 'Paradas' },
        { href: '/viagens/motoristas', label: 'Motoristas' },
        { href: '/viagens/ativos', label: 'Ativos' },
        { href: '/viagens/status', label: 'Histórico de status' },
      ]}
      integrationNotes={[
        'Fonte canônica: trip_transport_requests; somente contratos confirmados podem originar vínculos.',
        'Uma transport_request não pode permanecer ativa em mais de uma viagem ao mesmo tempo.',
        'Remoção é lifecycle auditável, nunca DELETE físico.',
      ]}
    />
  );
}
