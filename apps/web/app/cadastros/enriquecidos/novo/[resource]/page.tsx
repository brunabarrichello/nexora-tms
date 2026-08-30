import { notFound } from 'next/navigation';

import { RecordEditorPage } from '../../../../_components/record-editor-page';
import { getRecordConfig } from '../../../../_lib/record-config';

const allowed = new Set([
  'location',
  'department',
  'cost-center',
  'commodity',
  'party-group',
  'custom-field',
]);

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ resource: string }> }>) {
  const { resource } = await params;
  if (!allowed.has(resource) || !getRecordConfig(resource)) notFound();
  return <RecordEditorPage resource={resource} mode="create" />;
}
