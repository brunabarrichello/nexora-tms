import { DocumentUnlinkForm } from '../../../../../_components/document-forms';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ documentId: string; linkId: string }> }>) {
  const { documentId, linkId } = await params;
  return <DocumentUnlinkForm documentId={documentId} linkId={linkId} />;
}
