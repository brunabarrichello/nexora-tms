import { DocumentEditForm } from '../../../_components/document-forms';
import { OperationalPage } from '../../../_components/operational-page';
import { apiGet } from '../../../_lib/api-client';
import type { DocumentRecord } from '../../../_lib/document-ui';

export default async function Page({ params }: Readonly<{ params: Promise<{ documentId: string }> }>) {
  const { documentId } = await params;
  const result = await apiGet<DocumentRecord>(`/api/v1/documents/${documentId}`);
  if (result.kind !== 'ready') {
    return <OperationalPage eyebrow="Documents • Wave 0018" title="Editar documento" description="Edição dos metadados canônicos." status="Indisponível" filters={[]} columns={[{ key: 'status', label: 'Estado' }]} emptyTitle="Documento indisponível" emptyDescription={result.message} actions={[{ href: '/documentos', label: 'Voltar', variant: 'secondary' }]} />;
  }
  return <DocumentEditForm document={result.data} />;
}
