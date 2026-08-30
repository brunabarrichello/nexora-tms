import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Detalhe da viagem' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Viagens · Core"
      title="Detalhe operacional da viagem"
      description="Visão consolidada do planejamento da viagem, com contratos/cargas, paradas, equipe, ativos e lifecycle antes da execução detalhada."
      metrics={[
        { label: 'Status atual', helper: 'Lifecycle canônico da viagem' },
        { label: 'Cargas', helper: 'Solicitações contratadas vinculadas' },
        { label: 'Paradas', helper: 'Sequência operacional planejada' },
        { label: 'Capacidade', helper: 'Motoristas e ativos vigentes' },
      ]}
      filters={[
        { label: 'Viagem', name: 'trip', placeholder: 'Código ou identificador' },
        { label: 'Status', name: 'status', options: ['Planejada', 'Pronta', 'Em trânsito', 'Concluída', 'Cancelada'] },
      ]}
      columns={[
        { key: 'section', label: 'Seção' },
        { key: 'summary', label: 'Resumo' },
        { key: 'state', label: 'Situação' },
        { key: 'updatedAt', label: 'Atualização' },
      ]}
      tabs={[
        { href: '/viagens', label: 'Visão geral' },
        { href: '/viagens/detalhe', label: 'Detalhe' },
        { href: '/viagens/cargas', label: 'Cargas e contratos' },
        { href: '/viagens/paradas', label: 'Paradas' },
        { href: '/viagens/motoristas', label: 'Motoristas' },
        { href: '/viagens/ativos', label: 'Ativos' },
        { href: '/viagens/status', label: 'Histórico de status' },
      ]}
      integrationNotes={[
        'Esta página consolida apenas o core da Wave 0022; tracking, despesas, pedágios, combustível e POD permanecem na execução da Wave 0023.',
      ]}
    />
  );
}
