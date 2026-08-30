import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Rejeições do Matching' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Decisão impeditiva"
      title="Rejeições do Matching"
      description="Registro imutável dos motivos que impediram um candidato de seguir na seleção, com código, regra relacionada e contexto técnico da decisão."
      metrics={[
        { label: 'Rejeições', helper: 'Motivos persistidos' },
        { label: 'Capacidade', helper: 'Peso, volume e dimensões' },
        { label: 'Compliance', helper: 'Qualificação e bloqueios' },
        { label: 'Equipamento', helper: 'Tipo, carroceria e tracking' },
      ]}
      filters={[
        { label: 'Código', name: 'code', placeholder: 'Código da rejeição' },
        { label: 'Execução', name: 'run', placeholder: 'ID da execução' },
        { label: 'Candidato', name: 'candidate', placeholder: 'Motorista, placa ou atribuição' },
      ]}
      columns={[
        { key: 'candidate', label: 'Candidato' },
        { key: 'code', label: 'Código' },
        { key: 'rule', label: 'Regra' },
        { key: 'reason', label: 'Motivo' },
        { key: 'createdAt', label: 'Registrado em' },
        { key: 'status', label: 'Natureza' },
      ]}
      tabs={[
        { href: '/matching', label: 'Visão geral' },
        { href: '/matching/candidatos', label: 'Candidatos' },
        { href: '/matching/explicabilidade', label: 'Explicabilidade' },
        { href: '/matching/rejeicoes', label: 'Rejeições' },
      ]}
      integrationNotes={[
        'Rejeições são append-only: uma nova execução pode produzir decisão diferente, mas nunca reescreve a execução anterior.',
        'O contexto técnico poderá ser apresentado de forma segura sem expor dados sensíveis desnecessários.',
      ]}
    />
  );
}
