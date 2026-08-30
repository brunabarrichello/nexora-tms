import { RecordEditorPage } from '../../../_components/record-editor-page';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const raw = Array.isArray(params.partyId) ? params.partyId[0] : params.partyId;
  return <RecordEditorPage resource="party-requirement" mode="create" subjectId={raw} />;
}
