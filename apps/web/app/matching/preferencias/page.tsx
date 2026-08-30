import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Preferências de Matching' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Configuração operacional"
      title="Preferências de Matching"
      description="Perfis de execução com score mínimo, quantidade máxima de candidatos, inclusão de rejeitados e configuração complementar por tenant."
      metrics={[
        { label: 'Perfis ativos', helper: 'Preferências disponíveis' },
        { label: 'Perfil padrão', helper: 'Aplicado quando não informado' },
        { label: 'Score mínimo', helper: 'Threshold do perfil padrão' },
        { label: 'Limite', helper: 'Máximo de candidatos' },
      ]}
      filters={[
        { label: 'Estado', name: 'active', options: [{ label: 'Ativo', value: 'true' }, { label: 'Inativo', value: 'false' }] },
        { label: 'Padrão', name: 'default', options: [{ label: 'Somente padrão', value: 'true' }, { label: 'Não padrão', value: 'false' }] },
      ]}
      columns={[
        { key: 'name', label: 'Perfil' },
        { key: 'minimumScore', label: 'Score mínimo', align: 'right' },
        { key: 'maxCandidates', label: 'Máx. candidatos', align: 'right' },
        { key: 'includeRejected', label: 'Inclui rejeitados' },
        { key: 'default', label: 'Padrão' },
        { key: 'status', label: 'Status' },
      ]}
      tabs={[
        { href: '/matching', label: 'Visão geral' },
        { href: '/matching/regras', label: 'Regras' },
        { href: '/matching/preferencias', label: 'Preferências' },
        { href: '/matching/execucoes', label: 'Execuções' },
      ]}
      integrationNotes={[
        'Somente um perfil ativo poderá ser padrão por tenant.',
        'A execução preservará snapshot do perfil aplicado para garantir reprodutibilidade.',
      ]}
    />
  );
}
