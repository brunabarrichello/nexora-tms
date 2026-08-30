import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Ativos da viagem' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Viagens · Core"
      title="Ativos da viagem"
      description="Planeje veículo, cavalo, implementos e ativos de apoio da viagem usando o cadastro canônico de capacidade, com vigência e histórico de substituições."
      metrics={[
        { label: 'Veículos ativos', helper: 'Capacidade em uso na viagem' },
        { label: 'Implementos', helper: 'Implementos vinculados' },
        { label: 'Apoio', helper: 'Ativos auxiliares' },
        { label: 'Encerrados', helper: 'Histórico de vínculos' },
      ]}
      filters={[
        { label: 'Viagem', name: 'trip', placeholder: 'Código da viagem' },
        { label: 'Ativo', name: 'asset' },
        {
          label: 'Papel',
          name: 'role',
          options: ['Cavalo', 'Veículo', 'Implemento', 'Apoio'],
        },
        { label: 'Estado', name: 'state', options: ['Ativo', 'Encerrado'] },
      ]}
      columns={[
        { key: 'trip', label: 'Viagem' },
        { key: 'asset', label: 'Ativo' },
        { key: 'role', label: 'Papel' },
        { key: 'startsAt', label: 'Início' },
        { key: 'endsAt', label: 'Fim' },
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
        'Fonte canônica: trip_assets; capacity_assets permanece o root de veículo/implemento.',
        'O Core registra vigência do vínculo em vez de sobrescrever substituições anteriores.',
        'Localização e telemetria do ativo pertencem à execução da Wave 0023.',
      ]}
    />
  );
}
