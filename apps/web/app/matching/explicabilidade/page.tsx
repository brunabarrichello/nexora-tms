import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Explicabilidade do Matching' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Explicabilidade"
      title="Explicabilidade do Matching"
      description="Decomposição do score e dos resultados das regras para responder por que um candidato foi recomendado, penalizado ou rejeitado."
      metrics={[
        { label: 'Critérios avaliados', helper: 'Dimensões e regras' },
        { label: 'Passaram', helper: 'Regras atendidas' },
        { label: 'Penalidades', helper: 'Impactos não impeditivos' },
        { label: 'Blockers', helper: 'Falhas impeditivas' },
      ]}
      filters={[
        { label: 'Resultado', name: 'result', options: ['passed', 'failed', 'not_applicable'] },
        { label: 'Impacto', name: 'impact', options: ['blocker', 'penalty', 'bonus', 'neutral'] },
        { label: 'Regra', name: 'rule', placeholder: 'Código da regra' },
      ]}
      columns={[
        { key: 'candidate', label: 'Candidato' },
        { key: 'rule', label: 'Regra / dimensão' },
        { key: 'result', label: 'Resultado' },
        { key: 'impact', label: 'Impacto' },
        { key: 'delta', label: 'Δ Score', align: 'right' },
        { key: 'explanation', label: 'Explicação' },
      ]}
      tabs={[
        { href: '/matching', label: 'Visão geral' },
        { href: '/matching/candidatos', label: 'Candidatos' },
        { href: '/matching/explicabilidade', label: 'Explicabilidade' },
        { href: '/matching/rejeicoes', label: 'Rejeições' },
      ]}
      integrationNotes={[
        'matching_candidate_scores fornecerá a decomposição numérica por dimensão.',
        'matching_rule_results preservará regra, versão, impacto, mensagem, valor requerido e valor observado.',
      ]}
    />
  );
}
