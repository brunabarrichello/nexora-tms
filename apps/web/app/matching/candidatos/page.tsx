import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Candidatos do Matching' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Resultado persistido"
      title="Candidatos do Matching"
      description="Candidatos avaliados por execução, com vínculo canônico à capacidade, ranking, score total e resumo das razões que justificam a decisão."
      metrics={[
        { label: 'Avaliados', helper: 'Candidatos persistidos' },
        { label: 'Elegíveis', helper: 'Sem blockers' },
        { label: 'Rejeitados', helper: 'Com motivo impeditivo' },
        { label: 'Score médio', helper: 'Aderência operacional' },
      ]}
      filters={[
        { label: 'Status', name: 'status', options: ['eligible', 'rejected'] },
        { label: 'Execução', name: 'run', placeholder: 'ID da execução' },
        { label: 'Transportadora', name: 'carrier', placeholder: 'Nome ou ID' },
      ]}
      columns={[
        { key: 'rank', label: 'Rank', align: 'right' },
        { key: 'candidate', label: 'Motorista / veículo' },
        { key: 'carrier', label: 'Transportadora' },
        { key: 'score', label: 'Score', align: 'right' },
        { key: 'blockers', label: 'Blockers', align: 'right' },
        { key: 'status', label: 'Status' },
      ]}
      tabs={[
        { href: '/matching', label: 'Visão geral' },
        { href: '/matching/execucoes', label: 'Execuções' },
        { href: '/matching/candidatos', label: 'Candidatos' },
        { href: '/matching/explicabilidade', label: 'Explicabilidade' },
        { href: '/matching/rejeicoes', label: 'Rejeições' },
      ]}
      integrationNotes={[
        'Cada linha terá snapshot do candidato no momento da execução para evitar explicações dependentes do estado atual do cadastro.',
        'O ranking é resultado da execução, não um atributo permanente do motorista ou veículo.',
      ]}
    />
  );
}
