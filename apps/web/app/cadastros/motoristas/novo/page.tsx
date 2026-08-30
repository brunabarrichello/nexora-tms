import { RecordEditorPage } from '../../../_components/record-editor-page';

export const metadata = { title: 'Novo motorista' };

export default function Page() {
  return <RecordEditorPage resource="driver" mode="create" />;
}
