import { DocumentCreateForm } from '../../_components/document-forms';
import { apiGet } from '../../_lib/api-client';
import type { ReferenceDocumentTypePage } from '../../_lib/document-ui';

export const metadata = { title: 'Novo documento' };

export default async function Page() {
  const result = await apiGet<ReferenceDocumentTypePage>('/api/v1/reference-data/document-types', {
    active: 'true',
    limit: '100',
    offset: '0',
  });
  return <DocumentCreateForm documentTypes={result.kind === 'ready' ? result.data.items : []} />;
}
