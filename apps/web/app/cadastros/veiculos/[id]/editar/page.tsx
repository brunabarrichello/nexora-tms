import { RecordEditorPage } from '../../../../_components/record-editor-page';

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <RecordEditorPage resource="vehicle" mode="edit" id={id} />;
}
