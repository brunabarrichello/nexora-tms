import { OperationalPage } from '../_components/operational-page';

export const metadata = { title: 'Matching' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Inteligência operacional"
      title="Matching"
      description="Central de matching persistente e explicável entre cargas e capacidades, com execuções reproduzíveis, ranking, regras, scores e rejeições auditáveis."
      metrics={[
        { label: 'Cargas elegíveis', helper: 'Solicitações disponíveis para matching' },
        { label: 'Execuções', helper: 'Histórico persistido' },
        { label: 'Candidatos', helper: 'Resultados por execução' },
        { label: 'Rejeições', helper: 'Blockers explicados' },
      ]}
      filters={[
        { label: 'Score mínimo', name: 'score', options: ['90%+', '80%+', '70%+'] },
        { label: 'Status', name: 'status', options: ['eligible', 'rejected'] },
        { label: 'Execução', name: 'run', placeholder: 'ID da execução' },
      ]}
      columns={[
        { key: 'load', label: 'Carga' },
        { key: 'candidate', label: 'Candidato' },
        { key: 'score', label: 'Score', align: 'right' },
        { key: 'explanation', label: 'Principais critérios' },
        { key: 'status', label: 'Status' },
      ]}
      actions={[
        { href: '/matching/execucoes', label: 'Ver execuções' },
        { href: '/matching/regras', label: 'Configurar regras', variant: 'secondary' },
      ]}
      tabs={[
        { href: '/matching', label: 'Visão geral' },
        { href: '/matching/execucoes', label: 'Execuções' },
        { href: '/matching/candidatos', label: 'Candidatos' },
        { href: '/matching/explicabilidade', label: 'Explicabilidade' },
        { href: '/matching/rejeicoes', label: 'Rejeições' },
        { href: '/matching/regras', label: 'Regras' },
        { href: '/matching/preferencias', label: 'Preferências' },
        { href: '/matching/propostas', label: 'Propostas' },
      ]}
      integrationNotes={[
        'Wave 0020 persistirá cada execução com snapshot do algoritmo, preferências e regras.',
        'Candidatos, scores, resultados de regra e rejeições serão históricos imutáveis; negociação continua no bounded context existente.',
      ]}
    />
  );
}
