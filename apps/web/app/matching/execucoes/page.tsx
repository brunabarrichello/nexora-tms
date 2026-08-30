import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Execuções de Matching' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Matching persistente"
      title="Execuções de Matching"
      description="Histórico reproduzível de cada processamento de compatibilidade, com versão do algoritmo, preferência aplicada, contagens e estado da execução."
      metrics={[
        { label: 'Execuções', helper: 'Histórico persistido' },
        { label: 'Concluídas', helper: 'Processamentos finalizados' },
        { label: 'Em processamento', helper: 'Queued ou running' },
        { label: 'Com falha', helper: 'Falhas diagnosticáveis' },
      ]}
      filters={[
        {
          label: 'Status',
          name: 'status',
          options: ['queued', 'running', 'completed', 'failed', 'cancelled'],
        },
        { label: 'Algoritmo', name: 'algorithm', placeholder: 'Versão do algoritmo' },
        { label: 'Carga', name: 'request', placeholder: 'ID ou referência da carga' },
      ]}
      columns={[
        { key: 'run', label: 'Execução' },
        { key: 'request', label: 'Carga' },
        { key: 'algorithm', label: 'Algoritmo' },
        { key: 'evaluated', label: 'Avaliados', align: 'right' },
        { key: 'eligible', label: 'Elegíveis', align: 'right' },
        { key: 'rejected', label: 'Rejeitados', align: 'right' },
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
        'Fonte futura: matching_runs, com parâmetros e snapshot das regras usados em cada execução.',
        'Falhas preservam código e mensagem sem apagar resultados de execuções anteriores.',
      ]}
    />
  );
}
