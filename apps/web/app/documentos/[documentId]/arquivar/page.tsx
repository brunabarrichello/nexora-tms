import { DocumentArchiveForm } from '../../../_components/document-forms';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ documentId: string }> }>) {
  const { documentId } = await params;
  return <DocumentArchiveForm documentId={documentId} />;
}
