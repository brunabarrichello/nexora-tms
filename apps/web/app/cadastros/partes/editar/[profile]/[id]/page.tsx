import { notFound } from 'next/navigation';

import { RecordEditorPage } from '../../../../../_components/record-editor-page';

const profiles = {
  client: 'party-client',
  supplier: 'party-supplier',
  carrier: 'party-carrier',
} as const;

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ profile: string; id: string }> }>) {
  const { profile, id } = await params;
  const resource = profiles[profile as keyof typeof profiles];
  if (!resource) notFound();
  return <RecordEditorPage resource={resource} mode="edit" id={id} />;
}
