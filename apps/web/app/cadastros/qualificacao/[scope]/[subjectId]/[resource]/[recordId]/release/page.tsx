import { notFound } from 'next/navigation';

import { QualificationBlockReleaseForm } from '../../../../../../../_components/qualification-block-release-form';
import {
  qualificationConfigs,
  type QualificationResource,
} from '../../../../../../../_lib/qualification-config';

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ scope: string; subjectId: string; resource: string; recordId: string }>;
}>) {
  const { scope, subjectId, resource, recordId } = await params;
  if (resource !== 'driver-block' && resource !== 'asset-block') notFound();
  const config = qualificationConfigs[resource as QualificationResource];
  if (config.scope !== scope) notFound();
  return <QualificationBlockReleaseForm config={config} subjectId={subjectId} blockId={recordId} />;
}
