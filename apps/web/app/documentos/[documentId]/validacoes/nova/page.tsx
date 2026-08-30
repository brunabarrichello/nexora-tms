import { DocumentValidationForm } from '../../../../_components/document-forms';
import { apiGet } from '../../../../_lib/api-client';
import type { DocumentRecord } from '../../../../_lib/document-ui';

export default async function Page({ params }: Readonly<{ params: Promise<{ documentId: string }> }>) {
  const { documentId } = await params;
  const versions = await apiGet<readonly DocumentRecord[]>(`/api/v1/documents/${documentId}/versions`);
  return <DocumentValidationForm documentId={documentId} versions={versions.kind === 'ready' ? versions.data : []} />;
}
