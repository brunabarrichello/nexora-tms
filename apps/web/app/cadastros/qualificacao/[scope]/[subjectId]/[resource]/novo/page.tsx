import { notFound } from 'next/navigation';

import { QualificationEditorPage } from '../../../../../../_components/qualification-editor-page';
import type { QualificationScope } from '../../../../../../_lib/qualification-config';

type SearchValue = string | string[] | undefined;

export default async function Page({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ scope: string; subjectId: string; resource: string }>;
  searchParams: Promise<Record<string, SearchValue>>;
}>) {
  const { scope, subjectId, resource } = await params;
  if (scope !== 'driver' && scope !== 'asset') notFound();
  const query = await searchParams;
  const rawMaintenanceId = query.maintenanceId;
  const maintenanceId = Array.isArray(rawMaintenanceId) ? rawMaintenanceId[0] : rawMaintenanceId;
  return (
    <QualificationEditorPage
      scope={scope as QualificationScope}
      subjectId={subjectId}
      resource={resource}
      maintenanceId={maintenanceId}
    />
  );
}
