import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Validações documentais' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Documentos • Wave 0018"
      title="Validações"
      description="Fila de validação documental com decisão, motivo, evidência e auditoria."
      filters={[
        { label: 'Status', name: 'status', options: ['Pendente', 'Aprovado', 'Reprovado'] },
        { label: 'Tipo', name: 'type' },
      ]}
      columns={[
        { key: 'document', label: 'Documento' },
        { key: 'linkedTo', label: 'Vinculado a' },
        { key: 'submittedAt', label: 'Enviado em' },
        { key: 'validator', label: 'Validador' },
        { key: 'status', label: 'Status' },
      ]}
    />
  );
}
