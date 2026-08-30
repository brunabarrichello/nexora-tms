import { OperationalPage } from '../_components/operational-page';
export const metadata = { title: 'Ocorrências' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Execução • Exceções"
      title="Ocorrências"
      description="Registro estruturado de desvios, incidentes, atrasos, avarias e tratativas durante a operação."
      actions={[{ href: '/ocorrencias/nova', label: 'Nova ocorrência' }]}
      metrics={[
        { label: 'Abertas', helper: 'Aguardando tratativa' },
        { label: 'Críticas', helper: 'Severidade alta/crítica' },
        { label: 'Fora do SLA', helper: 'Prazo de resolução' },
        { label: 'Encerradas', helper: 'Histórico operacional' },
      ]}
      filters={[
        { label: 'Severidade', name: 'severity', options: ['Baixa', 'Média', 'Alta', 'Crítica'] },
        {
          label: 'Status',
          name: 'status',
          options: ['Aberta', 'Em tratativa', 'Resolvida', 'Cancelada'],
        },
        {
          label: 'Tipo',
          name: 'type',
          options: [
            'Atraso',
            'Avaria',
            'Sinistro',
            'Documental',
            'Comunicação',
            'Operacional',
            'Outro',
          ],
        },
      ]}
      columns={[
        { key: 'code', label: 'Ocorrência' },
        { key: 'type', label: 'Tipo' },
        { key: 'relatedTo', label: 'Relacionado a' },
        { key: 'severity', label: 'Severidade' },
        { key: 'status', label: 'Status' },
      ]}
      integrationNotes={[
        'Timeline, anexos, responsáveis, SLA e ações corretivas permanecerão auditáveis.',
      ]}
    />
  );
}
