import { DocumentValidationForm } from '../../../../_components/document-forms';
import { apiGet } from '../../../../_lib/api-client';
import { documentText, type DocumentRecord } from '../../../../_lib/document-ui';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ documentId: string }> }>) {
  const { documentId } = await params;
  const versions = await apiGet<readonly DocumentRecord[]>(`/api/v1/documents/${documentId}/versions`);
  const options =
    versions.kind === 'ready'
      ? versions.data.map((version) => ({
          id: documentText(version.id),
          label: `v${documentText(version.version_number)} • ${documentText(version.file_name)}`,
        }))
      : [];
  return <DocumentValidationForm documentId={documentId} versions={options} />;
}
