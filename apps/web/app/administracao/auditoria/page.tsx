import { OperationalPage } from '../../_components/operational-page';
export const metadata = { title: 'Auditoria' };
export default function Page() {
  return (
    <OperationalPage
      eyebrow="Administração • Governança"
      title="Auditoria"
      description="Trilha transversal de ações, alterações, lifecycle e eventos sensíveis do Nexora TMS."
      metrics={[
        { label: 'Eventos hoje', helper: 'Audit log' },
        { label: 'Alterações críticas', helper: 'Classificação configurável' },
        { label: 'Ações de sistema', helper: 'Workers e integrações' },
      ]}
      filters={[
        { label: 'Ator', name: 'actor' },
        { label: 'Ação', name: 'action' },
        { label: 'Entidade', name: 'entity' },
        { label: 'Período', name: 'period' },
      ]}
      columns={[
        { key: 'occurredAt', label: 'Data/hora' },
        { key: 'actor', label: 'Ator' },
        { key: 'action', label: 'Ação' },
        { key: 'entity', label: 'Entidade' },
        { key: 'status', label: 'Resultado' },
      ]}
      integrationNotes={[
        'Audit log será append-only e não dependerá do soft delete das entidades auditadas.',
      ]}
    />
  );
}
