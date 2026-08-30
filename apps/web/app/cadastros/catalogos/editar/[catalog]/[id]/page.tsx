import { notFound } from 'next/navigation';

import { ReferenceCatalogEditorPage } from '../../../_components/reference-catalog-editor-page';
import { getEditableReferenceCatalog } from '../../../_lib/reference-catalog-config';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ catalog: string; id: string }> }>) {
  const { catalog, id } = await params;
  if (!getEditableReferenceCatalog(catalog)) notFound();
  return <ReferenceCatalogEditorPage catalog={catalog} mode="edit" id={id} />;
}
