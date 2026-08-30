import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Vencimentos documentais' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Documentos • Wave 0018"
      title="Vencimentos"
      description="Agenda de vencimentos, alertas e bloqueios decorrentes de documentação expirada ou próxima do vencimento."
      filters={[
        { label: 'Janela', name: 'window', options: ['7 dias', '15 dias', '30 dias', '60 dias'] },
        { label: 'Escopo', name: 'scope' },
      ]}
      columns={[
        { key: 'document', label: 'Documento' },
        { key: 'linkedTo', label: 'Vinculado a' },
        { key: 'expiresAt', label: 'Vence em' },
        { key: 'days', label: 'Dias restantes' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
