import { OperationalPage } from '../../_components/operational-page';

export const metadata = { title: 'Propostas de matching' };

export default function Page() {
  return (
    <OperationalPage
      eyebrow="Matching • Proposals"
      title="Propostas"
      description="Propostas geradas a partir de resultados de matching, preservando candidato, score e justificativas."
      filters={[
        { label: 'Estado', name: 'status', options: ['Gerada', 'Enviada', 'Aceita', 'Recusada', 'Expirada'] },
        { label: 'Carga', name: 'load' },
        { label: 'Candidato', name: 'candidate' },
      ]}
      columns={[
        { key: 'proposal', label: 'Proposta' },
        { key: 'load', label: 'Carga' },
        { key: 'candidate', label: 'Candidato' },
        { key: 'score', label: 'Score' },
        { key: 'status', label: 'Estado' },
      ]}
    />
  );
}
