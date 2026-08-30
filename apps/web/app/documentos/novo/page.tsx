import { DocumentCreateForm } from '../../_components/document-forms';
import { OperationalPage } from '../../_components/operational-page';
import { apiGet } from '../../_lib/api-client';
import type { ReferenceDocumentTypePage } from '../../_lib/document-ui';

export const metadata = { title: 'Novo documento' };

export default async function Page() {
  const types = await apiGet<ReferenceDocumentTypePage>('/api/v1/reference-data/document-types', {
    active: 'true',
    limit: '100',
  });
  if (types.kind !== 'ready') {
    return (
      <OperationalPage
        eyebrow="Documents • Wave 0018"
        title="Novo documento"
        description="O formulário depende do catálogo real de tipos documentais do tenant."
        status={types.kind === 'unauthorized' ? 'Autorização pendente' : 'Catálogo indisponível'}
        filters={[]}
        columns={[{ key: 'status', label: 'Estado' }]}
        emptyTitle="Tipos documentais não disponíveis"
        emptyDescription={types.message}
        actions={[{ href: '/documentos', label: 'Voltar', variant: 'secondary' }]}
      />
    );
  }
  return <DocumentCreateForm documentTypes={types.data.items} />;
}
