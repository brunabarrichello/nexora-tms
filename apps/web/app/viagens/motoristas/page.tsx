import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Motoristas da viagem' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Viagens · Core"
      title="Motoristas da viagem"
      description="Planeje motorista principal, secundários e rendições por viagem, com vigência explícita e vínculo tenant-safe ao cadastro canônico de motoristas."
      metrics={[
        { label: 'Principais', helper: 'Um principal ativo por viagem' },
        { label: 'Secundários', helper: 'Apoio operacional ativo' },
        { label: 'Rendições', helper: 'Trocas planejadas' },
        { label: 'Encerrados', helper: 'Vínculos históricos' },
      ]}
      filters={[
        { label: 'Viagem', name: 'trip', placeholder: 'Código da viagem' },
        { label: 'Motorista', name: 'driver' },
        { label: 'Papel', name: 'role', options: ['Principal', 'Secundário', 'Rendição'] },
        { label: 'Estado', name: 'state', options: ['Ativo', 'Encerrado'] },
      ]}
      columns={[
        { key: 'trip', label: 'Viagem' },
        { key: 'driver', label: 'Motorista' },
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
        'Fonte canônica: trip_drivers; drivers permanece o root de cadastro.',
        'O Core impede mais de um motorista principal ativo na mesma viagem.',
        'Trocas durante execução serão enriquecidas por eventos operacionais na Wave 0023.',
      ]}
    />
  );
}
