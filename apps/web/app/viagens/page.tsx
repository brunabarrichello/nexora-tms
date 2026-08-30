import { OperationalPage } from '../_components/operational-page';

export const metadata = { title: 'Viagens' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Viagens"
      title="Planejamento e execução de viagens"
      description="Consolide contratos confirmados em viagens, planeje paradas, motorista e ativos, acompanhe o lifecycle e evolua para tracking, custos e POD sem misturar o Core com a execução."
      actions={[{ href: '/viagens/nova', label: 'Nova viagem' }]}
      metrics={[
        { label: 'Planejadas', helper: 'Montagem operacional' },
        { label: 'Prontas', helper: 'Liberadas para início' },
        { label: 'Em trânsito', helper: 'Execução ativa' },
        { label: 'Finalizadas', helper: 'Concluídas ou canceladas' },
      ]}
      filters={[
        {
          label: 'Status',
          name: 'status',
          options: ['Planejada', 'Pronta', 'Em trânsito', 'Concluída', 'Cancelada'],
        },
        { label: 'Motorista', name: 'driver' },
        { label: 'Ativo', name: 'asset' },
        { label: 'Período', name: 'period' },
      ]}
      columns={[
        { key: 'code', label: 'Viagem' },
        { key: 'route', label: 'Rota' },
        { key: 'requests', label: 'Cargas', align: 'right' },
        { key: 'driver', label: 'Motorista principal' },
        { key: 'asset', label: 'Ativo principal' },
        { key: 'status', label: 'Status' },
      ]}
      tabs={[
        { href: '/viagens', label: 'Todas' },
        { href: '/viagens/cargas', label: 'Cargas e contratos' },
        { href: '/viagens/paradas', label: 'Paradas' },
        { href: '/viagens/motoristas', label: 'Motoristas' },
        { href: '/viagens/ativos', label: 'Ativos' },
        { href: '/viagens/status', label: 'Histórico de status' },
        { href: '/viagens/marcos', label: 'Marcos' },
        { href: '/viagens/tracking', label: 'Tracking' },
        { href: '/viagens/despesas', label: 'Despesas' },
        { href: '/viagens/pedagios', label: 'Pedágios' },
        { href: '/viagens/combustivel', label: 'Combustível' },
        { href: '/viagens/pod', label: 'POD' },
        { href: '/ocorrencias', label: 'Ocorrências' },
      ]}
      integrationNotes={[
        'Wave 0022 Core: trips, cargas/contratos, paradas planejadas, motoristas, ativos e histórico de status.',
        'Wave 0023 Execução: marcos operacionais, tracking, despesas, pedágios, combustível, POD e eventos em campo.',
        'Uma carga contratada pode permanecer ativa em somente uma viagem por vez.',
      ]}
    />
  );
}
